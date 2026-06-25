import type { EndpointParameter, NormalizedEndpoint } from "@reqsmith/contracts";

/** Result of generating data for one endpoint. */
export interface GeneratedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  body?: unknown;
  generationInfo: GenerationInfo[];
}

export interface GenerationInfo {
  field: string;
  generatorId: string;
  reason: string;
  confidence: number;
}

/** LLM-based value generator — injected by the host app. */
export interface LLMGenerator {
  /**
   * Ask the LLM to generate parameter values for an endpoint.
   * Returns a map of param-name → generated value, or null if unavailable.
   */
  generateValues(endpoint: EndpointContext, params: EndpointParameter[]): Promise<Record<string, string> | null>;
}

/** Minimal endpoint context for LLM prompts. */
export interface EndpointContext {
  method: string;
  path: string;
  name: string;
  group: string;
  tags: string[];
  parameters: EndpointParameter[];
}

/* ── Semantic field name patterns ── */

const SEMANTIC_GENERATORS: Array<{ pattern: RegExp; gen: () => string; reason: string }> = [
  { pattern: /id$/i, gen: () => crypto.randomUUID().slice(0, 8), reason: "ID field" },
  { pattern: /^(userId|orderId|projectId|accountId)$/i, gen: () => String(Math.floor(Math.random() * 10000) + 1), reason: "entity ID" },
  { pattern: /email/i, gen: () => `user${Math.floor(Math.random() * 999)}@example.com`, reason: "email field" },
  { pattern: /phone|mobile/i, gen: () => "13800138000", reason: "phone field" },
  { pattern: /username|nickname/i, gen: () => `user_${Math.floor(Math.random() * 9999)}`, reason: "username field" },
  { pattern: /name$/i, gen: () => "测试名称", reason: "name field" },
  { pattern: /password|passwd/i, gen: () => "Test1234!", reason: "password field" },
  { pattern: /token|accessToken/i, gen: () => "test-token-xxx", reason: "token field" },
  { pattern: /url|uri|link/i, gen: () => "https://example.com", reason: "URL field" },
  { pattern: /ip$/i, gen: () => "127.0.0.1", reason: "IP field" },
  { pattern: /date$/i, gen: () => new Date().toISOString().split("T")[0], reason: "date field" },
  { pattern: /time$|datetime/i, gen: () => new Date().toISOString(), reason: "datetime field" },
  { pattern: /amount|price|fee/i, gen: () => "100.00", reason: "monetary field" },
  { pattern: /page|pageNum/i, gen: () => "1", reason: "pagination" },
  { pattern: /pageSize|size|limit/i, gen: () => "20", reason: "pagination size" },
  { pattern: /offset/i, gen: () => "0", reason: "pagination offset" },
  { pattern: /province/i, gen: () => "广东省", reason: "province field" },
  { pattern: /city/i, gen: () => "广州市", reason: "city field" },
  { pattern: /address/i, gen: () => "测试地址123号", reason: "address field" },
  { pattern: /code$|codeType/i, gen: () => "01", reason: "code field" },
  { pattern: /type$|typeCode/i, gen: () => "1", reason: "type field" },
  { pattern: /status$/i, gen: () => "1", reason: "status field" },
  { pattern: /idCard|identityCard/i, gen: () => "440000199001010001", reason: "ID card (test value)" },
];

/* ── Type-based generators ── */

const TYPE_GENERATORS: Record<string, () => string> = {
  string: () => "测试值",
  number: () => String(Math.floor(Math.random() * 100) + 1),
  boolean: () => "true",
  integer: () => String(Math.floor(Math.random() * 100) + 1),
  binary: () => "",
};

function generateForParam(param: EndpointParameter): { value: string; info: GenerationInfo } {
  // 1. Semantic match
  for (const sg of SEMANTIC_GENERATORS) {
    if (sg.pattern.test(param.name)) {
      return {
        value: sg.gen(),
        info: { field: param.name, generatorId: "semantic", reason: sg.reason, confidence: 0.9 },
      };
    }
  }

  // 2. Type-based
  const typeGen = TYPE_GENERATORS[param.type];
  if (typeGen) {
    return {
      value: typeGen(),
      info: { field: param.name, generatorId: "type", reason: `type: ${param.type}`, confidence: 0.6 },
    };
  }

  // 3. Default
  return {
    value: "测试值",
    info: { field: param.name, generatorId: "default", reason: "fallback", confidence: 0.3 },
  };
}

/* ── Main generator ── */

export function generateRequest(
  endpoint: NormalizedEndpoint,
  baseUrl: string,
  llm?: LLMGenerator,
): GeneratedRequest {
  const info: GenerationInfo[] = [];
  const params: Record<string, string> = {};
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: unknown = undefined;

  for (const param of endpoint.parameters) {
    const { value, info: genInfo } = generateForParam(param);
    info.push(genInfo);

    switch (param.location) {
      case "path":
        params[param.name] = value;
        break;
      case "query":
        params[param.name] = value;
        break;
      case "header":
        headers[param.name] = value;
        break;
      case "cookie":
        headers["Cookie"] = (headers["Cookie"] ?? "") + `${param.name}=${value}; `;
        break;
      case "body":
        body = body ?? {};
        if (typeof body === "object" && body !== null) {
          (body as Record<string, unknown>)[param.name] = tryParseValue(value, param.type);
        }
        break;
    }
  }

  // If there's a requestBody schema ref but no body params, generate a skeleton
  if (endpoint.requestBody?.schemaRef && !body) {
    body = { /* TODO: generate from schema */ };
    info.push({ field: "body", generatorId: "schema-ref", reason: `schema: ${endpoint.requestBody.schemaRef}`, confidence: 0.4 });
  }

  // Build URL with path params
  let url = `${baseUrl}${endpoint.path}`;
  for (const [key, val] of Object.entries(params)) {
    url = url.replace(`{${key}}`, encodeURIComponent(val));
  }

  // Add query params (skip path params that were already substituted)
  const pathParamNames = endpoint.parameters
    .filter((p) => p.location === "path")
    .map((p) => p.name);
  const queryParams = Object.entries(params).filter(([k]) => !pathParamNames.includes(k));
  if (queryParams.length > 0) {
    url += "?" + queryParams.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  }

  const result: GeneratedRequest = { method: endpoint.method, url, headers, params, body, generationInfo: info };

  // Async LLM enhancement — caller can await this separately
  if (llm) {
    result._llmPending = enhanceWithLLM(endpoint, llm);
  }

  return result;
}

/** LLM enhancement — returns a promise that resolves to better param values. */
export async function enhanceWithLLM(
  endpoint: NormalizedEndpoint,
  llm: LLMGenerator,
): Promise<Record<string, string> | null> {
  try {
    const ctx: EndpointContext = {
      method: endpoint.method,
      path: endpoint.path,
      name: endpoint.name,
      group: endpoint.group,
      tags: endpoint.tags,
      parameters: endpoint.parameters,
    };
    return await llm.generateValues(ctx, endpoint.parameters);
  } catch {
    return null;
  }
}

/** Merge LLM-generated values into an existing GeneratedRequest. */
export function mergeLLMValues(
  base: GeneratedRequest,
  llmValues: Record<string, string>,
): GeneratedRequest {
  const merged = { ...base };
  merged.params = { ...merged.params, ...llmValues };
  merged.generationInfo = [
    ...merged.generationInfo,
    ...Object.keys(llmValues).map((k) => ({
      field: k,
      generatorId: "llm",
      reason: "LLM-inferred",
      confidence: 0.85,
    })),
  ];

  // Rebuild URL with merged params
  let url = `${base.url.split("?")[0]}`;
  for (const [key, val] of Object.entries(merged.params)) {
    url = url.replace(`{${key}}`, encodeURIComponent(val));
  }
  // Use existing params to determine query vs path
  const queryParams = Object.entries(merged.params).filter(
    ([k]) => !url.includes(`{${k}}`) && !base.url.split("?")[0].includes(`{${k}}`),
  );
  if (queryParams.length > 0) {
    url += "?" + queryParams.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  }
  merged.url = url;

  return merged;
}

// Extend GeneratedRequest to optionally carry a pending LLM promise
declare module "./generator.js" {
  interface GeneratedRequest {
    _llmPending?: Promise<Record<string, string> | null>;
  }
}

function tryParseValue(value: string, type: string): unknown {
  if (type === "number" || type === "integer") {
    const n = Number(value);
    return isNaN(n) ? value : n;
  }
  if (type === "boolean") return value === "true";
  return value;
}
