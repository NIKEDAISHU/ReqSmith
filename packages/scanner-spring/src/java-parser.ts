import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import picomatch from "picomatch";

/** One endpoint discovered from a Spring controller method. */
export interface DiscoveredEndpoint {
  method: string;
  path: string;
  name: string;
  group: string;
  parameters: DiscoveredParam[];
  requestBodyType: string | null;
  requiresAuth: boolean;
  returnTypeName: string | null;
  source: {
    filePath: string;
    relativePath: string;
    startLine: number;
    endLine: number;
    className: string;
    methodName: string;
  };
  sourceFileModifiedAt: number;
  sourceMethodLine: number;
  sourceClassLine: number;
  fingerprint: string;
}

export interface ScanResult {
  endpoints: DiscoveredEndpoint[];
  config: SpringConfig;
}

export interface DiscoveredParam {
  name: string;
  location: "path" | "query" | "header" | "cookie" | "body" | "part";
  required: boolean;
  type: string;
}

/* ── helpers ── */

const CLASS_MAPPING_RE = /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/;

const PARAM_ANNOTATION_RE =
  /@(PathVariable|RequestParam|RequestHeader|CookieValue|RequestBody|RequestPart)(?:\s*\([^)]*\))?\s+(?:private\s+|protected\s+|public\s+)?(?:final\s+)?(\S+)\s+(\w+)/g;

const METHOD_PARAM_RE =
  /@(PathVariable|RequestParam|RequestHeader|CookieValue|RequestBody|RequestPart)(?:\s*\(\s*(?:value\s*=\s*)?["']([^"']*)["'][^)]*\))?/g;

const SKIP_PARAM_ANNOTATIONS = /@(AuthenticationPrincipal|Authentication|Principal|CurrentUser|ModelAttribute)\b/;

function extractMappingAttributes(attrString: string): { path: string; method: string | null } {
  let path = "";
  let method: string | null = null;

  if (!attrString) return { path: "/", method: null };

  const pathAttr = attrString.match(/(?:value|path)\s*=\s*["']([^"']+)["']/);
  if (pathAttr) {
    path = pathAttr[1];
  } else {
    const bareStr = attrString.match(/^\s*["']([^"']+)["']/);
    if (bareStr) path = bareStr[1];
  }

  const methodAttr = attrString.match(/method\s*=\s*(?:RequestMethod\.)?(\w+)/);
  if (methodAttr) method = methodAttr[1];

  return { path: path || "/", method };
}

function normalizePath(base: string, segment: string): string {
  let p = `${base}/${segment}`;
  p = p.replace(/\/+/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

function javaTypeToTs(javaType: string): string {
  const t = javaType.replace(/[<>]/g, "").trim();
  const map: Record<string, string> = {
    String: "string",
    Integer: "number",
    int: "number",
    Long: "number",
    long: "number",
    Double: "number",
    double: "number",
    Float: "number",
    float: "number",
    Boolean: "boolean",
    boolean: "boolean",
    BigDecimal: "number",
    LocalDate: "string",
    LocalDateTime: "string",
    Date: "string",
    MultipartFile: "binary",
  };
  return map[t] ?? t;
}

function annotationToLocation(anno: string): DiscoveredParam["location"] {
  const m: Record<string, DiscoveredParam["location"]> = {
    PathVariable: "path",
    RequestParam: "query",
    RequestHeader: "header",
    CookieValue: "cookie",
    RequestBody: "body",
    RequestPart: "part",
  };
  return m[anno] ?? "query";
}

function isRequired(anno: string): boolean {
  if (anno === "PathVariable" || anno === "RequestBody") return true;
  return false;
}

/* ── file discovery ── */

async function walkJavaFiles(dir: string, rootDir: string): Promise<string[]> {
  const isJava = picomatch("**/*.java");
  const skip = picomatch(["**/target/**", "**/build/**", "**/.git/**", "**/node_modules/**"]);
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      const rel = relative(rootDir, full);
      if (skip(rel)) continue;
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && isJava(rel)) {
        results.push(full);
      }
    }
  }

  await walk(dir);
  return results;
}

/* ── Spring config discovery ── */

export interface SpringConfig {
  contextPath: string;
  port: number;
}

async function discoverSpringConfig(projectDir: string): Promise<SpringConfig> {
  const config: SpringConfig = { contextPath: "", port: 8080 };
  const yamlPattern = picomatch("**/*.{yml,yaml}");

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && yamlPattern(entry.name)) {
        try {
          const content = await readFile(full, "utf-8");
          const cpMatch = content.match(/context-path:\s*([\/\w-]+)/);
          if (cpMatch) config.contextPath = cpMatch[1];
          const portMatch = content.match(/(?:^\s*)port:\s*(\d+)/m);
          if (portMatch) config.port = parseInt(portMatch[1], 10);
        } catch { /* skip unreadable files */ }
      }
    }
  }

  try {
    await walk(projectDir);
  } catch { /* ignore */ }
  return config;
}

/* ── main parser ── */

export async function scanSpringProject(
  projectDir: string,
  projectId: string,
  signal: AbortSignal,
  onProgress: (msg: string) => void,
): Promise<ScanResult> {
  const endpoints: DiscoveredEndpoint[] = [];
  const javaFiles = await walkJavaFiles(projectDir, projectDir);
  onProgress(`Found ${javaFiles.length} Java files`);

  // Collect file modification times for sorting
  const fileStats = new Map<string, number>();
  for (const filePath of javaFiles) {
    try {
      const st = await stat(filePath);
      fileStats.set(filePath, st.mtimeMs);
    } catch { /* ignore */ }
  }

  let parsed = 0;
  for (const filePath of javaFiles) {
    if (signal.aborted) break;

    const content = await readFile(filePath, "utf-8");
    const relativePath = relative(projectDir, filePath).split(sep).join("/");
    const lines = content.split("\n");
    parsed++;

    if (parsed % 50 === 0) {
      onProgress(`Parsed ${parsed}/${javaFiles.length} files, found ${endpoints.length} endpoints`);
    }

    if (
      !content.includes("@RestController") &&
      !content.includes("@Controller") &&
      !content.includes("@RequestMapping")
    ) {
      continue;
    }

    let classBasePath = "";
    const classMatch = content.match(CLASS_MAPPING_RE);
    if (classMatch) classBasePath = classMatch[1];

    const classDeclMatch = content.match(/public\s+(?:class|abstract\s+class)\s+(\w+)/);
    const className = classDeclMatch ? classDeclMatch[1] : "Unknown";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const mappingPrefix of [
        "GetMapping",
        "PostMapping",
        "PutMapping",
        "PatchMapping",
        "DeleteMapping",
        "HeadMapping",
        "OptionsMapping",
        "RequestMapping",
      ]) {
        const re = new RegExp(
          `@${mappingPrefix}\\s*(?:\\(\\s*([^)]*)\\s*\\))?`,
        );
        const m = re.exec(line);
        if (!m) continue;

        const attrStr = m[1] ?? "";

        let httpMethod: string;
        let mappingPath: string;

        if (mappingPrefix === "RequestMapping") {
          const attrs = extractMappingAttributes(attrStr);
          httpMethod = attrs.method ?? "GET";
          mappingPath = attrs.path;
        } else {
          httpMethod = mappingPrefix.replace("Mapping", "").toUpperCase();
          const attrs = extractMappingAttributes(attrStr);
          mappingPath = attrs.path;
        }

        const fullPath = normalizePath(classBasePath, mappingPath);

        let methodLine = i;
        let methodSignature = "";
        for (let j = i; j < Math.min(i + 5, lines.length); j++) {
          const methodMatch = lines[j].match(
            /(?:public|protected|private)\s+(?:[\w<>\[\],\s]+?)\s+(\w+)\s*\(([^)]*)\)/,
          );
          if (methodMatch) {
            methodSignature = methodMatch[0];
            methodLine = j;
            break;
          }
        }

        const methodNameMatch = methodSignature.match(/(\w+)\s*\(/);
        const methodName = methodNameMatch ? methodNameMatch[1] : `line${i}`;

        const returnMatch = methodSignature.match(
          /(?:public|protected|private)\s+([\w<>\[\],\s]+?)\s+\w+\s*\(/,
        );
        const returnTypeName = returnMatch ? returnMatch[1].trim() : null;

        const { params: sigParams, hasAuthPrincipal } = extractParamsFromSignature(methodSignature);

        const blockEnd = Math.min(methodLine + 30, lines.length);
        const methodBlock = lines.slice(i, blockEnd).join("\n");
        const fieldParams = extractFieldParams(methodBlock);

        const allParams = [...sigParams, ...fieldParams];

        const hasRequestBody = allParams.some((p) => p.location === "body");
        const requestBodyType = hasRequestBody
          ? allParams.find((p) => p.location === "body")?.type ?? null
          : null;

        const fingerprint = hashStr(
          `${projectId}:${httpMethod}:${fullPath}:${className}:${methodName}`,
        );

        endpoints.push({
          method: httpMethod,
          path: fullPath,
          name: methodName,
          group: className,
          parameters: allParams,
          requiresAuth: hasAuthPrincipal,
          requestBodyType,
          returnTypeName,
          source: {
            filePath,
            relativePath,
            startLine: i + 1,
            endLine: methodLine + 1,
            className,
            methodName,
          },
          sourceFileModifiedAt: fileStats.get(filePath) ?? Date.now(),
          sourceMethodLine: methodLine + 1,
          sourceClassLine: i + 1,
          fingerprint,
        });

        break; // one mapping per line
      }
    }
  }

  onProgress(`Scan complete: ${endpoints.length} endpoints found in ${parsed} files`);
  const config = await discoverSpringConfig(projectDir);
  return { endpoints, config };
}

/* ── param extraction ── */

function extractParamsFromSignature(sig: string): { params: DiscoveredParam[]; hasAuthPrincipal: boolean } {
  const params: DiscoveredParam[] = [];
  let hasAuthPrincipal = false;
  if (!sig) return { params, hasAuthPrincipal };

  const parenStart = sig.indexOf("(");
  const parenEnd = sig.lastIndexOf(")");
  if (parenStart === -1 || parenEnd === -1) return { params, hasAuthPrincipal };
  const paramStr = sig.substring(parenStart + 1, parenEnd);

  const parts = splitParams(paramStr);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (SKIP_PARAM_ANNOTATIONS.test(trimmed)) {
      hasAuthPrincipal = true;
      continue;
    }

    METHOD_PARAM_RE.lastIndex = 0;
    const annoMatch = METHOD_PARAM_RE.exec(trimmed);

    if (annoMatch) {
      const annoType = annoMatch[1];
      const annoValue = annoMatch[2] || "";
      const afterAnno = trimmed.substring(annoMatch.index + annoMatch[0].length).trim();
      const typeAndName = afterAnno.match(/(\S+)\s+(\w+)/);

      params.push({
        name: annoValue || typeAndName?.[2] || "param",
        location: annotationToLocation(annoType),
        required: isRequired(annoType),
        type: javaTypeToTs(typeAndName?.[1] || "string"),
      });
    } else {
      const plainMatch = trimmed.match(/(\S+)\s+(\w+)\s*$/);
      if (plainMatch) {
        const type = plainMatch[1];
        const name = plainMatch[2];
        const isSimple = /^(String|Integer|int|Long|long|Double|double|Float|float|Boolean|boolean|BigDecimal|LocalDate|LocalDateTime|Date|MultipartFile|HttpServletResponse|HttpServletRequest|Principal|Authentication|UserDetailsDto|Model|BindingResult|Pageable|Sort|HttpSession|ServletRequest|ServletResponse|WebRequest|NativeWebRequest|RedirectAttributes|FlashMap|Locale|TimeZone|ZoneId|InputStream|OutputStream|Reader|Writer|Principal)$/.test(type);
        if (type === "UserDetailsDto" || type === "Principal" || type === "Authentication") {
          hasAuthPrincipal = true;
          continue;
        }
        params.push({
          name,
          location: isSimple ? "query" : "body",
          required: true,
          type: javaTypeToTs(type),
        });
      }
    }
  }

  return { params, hasAuthPrincipal };
}

function extractFieldParams(block: string): DiscoveredParam[] {
  const params: DiscoveredParam[] = [];
  PARAM_ANNOTATION_RE.lastIndex = 0;
  let m;
  while ((m = PARAM_ANNOTATION_RE.exec(block)) !== null) {
    const annoType = m[1];
    const javaType = m[2];
    const name = m[3];
    params.push({
      name,
      location: annotationToLocation(annoType),
      required: isRequired(annoType),
      type: javaTypeToTs(javaType),
    });
  }
  return params;
}

/** Split parameter string by comma, respecting generic brackets. */
function splitParams(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of s) {
    if (ch === "<") depth++;
    else if (ch === ">") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/** Simple djb2 hash for fingerprint. */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0xffffffff;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}