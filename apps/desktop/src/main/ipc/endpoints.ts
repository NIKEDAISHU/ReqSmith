import { ipcMain, type IpcMainInvokeEvent, net } from "electron";
import type { Kysely } from "kysely";
import type { Database } from "@reqsmith/persistence";
import { EndpointRepository } from "@reqsmith/persistence";
import type { NormalizedEndpoint } from "@reqsmith/contracts";
import { ProjectIdSchema } from "@reqsmith/contracts";
import { generateRequest } from "@reqsmith/data-generator";
import type { EndpointContext } from "@reqsmith/data-generator";
import { getDefaultLLMConfig, createLLMGenerator } from "./llm.js";
import { ParamResolver } from "../param-resolver.js";

/** In-memory session cookies per base URL */
const sessionCookies = new Map<string, string>();

export function getSessionCookie(baseUrl: string): string {
  return sessionCookies.get(baseUrl) ?? "";
}

export function setSessionCookie(baseUrl: string, cookie: string): void {
  sessionCookies.set(baseUrl, cookie);
}

/** Find an endpoint by ID and also return the project's base_url */
async function findEndpointWithBaseUrl(
  db: Kysely<Database>,
  repo: EndpointRepository,
  endpointId: string,
): Promise<{ endpoint: NormalizedEndpoint; baseUrl: string; projectId: string } | null> {
  const allProjects = await db.selectFrom("project").select(["id", "base_url"]).execute();
  for (const p of allProjects) {
    const endpoints = await repo.listByProject(p.id);
    const found = endpoints.find((ep) => ep.id === endpointId);
    if (found) {
      return { endpoint: found, baseUrl: p.base_url || "http://localhost:8080", projectId: p.id };
    }
  }
  return null;
}

export function registerEndpointIpc(db: Kysely<Database>): void {
  const repo = new EndpointRepository(db);

  ipcMain.handle("endpoints:list", async (_event: IpcMainInvokeEvent, raw: unknown) => {
    const query = raw as Record<string, unknown>;
    const projectId = ProjectIdSchema.parse(query.projectId);
    const endpoints = await repo.listByProject(projectId);

    let filtered = endpoints;
    if (query.method && typeof query.method === "string") {
      filtered = filtered.filter((ep) => ep.method === query.method);
    }
    if (query.group && typeof query.group === "string") {
      filtered = filtered.filter((ep) => ep.group === query.group);
    }
    if (query.tag && typeof query.tag === "string") {
      filtered = filtered.filter((ep) => ep.tags.includes(query.tag as string));
    }
    if (query.search && typeof query.search === "string") {
      const s = (query.search as string).toLowerCase();
      filtered = filtered.filter(
        (ep) =>
          ep.path.toLowerCase().includes(s) ||
          ep.name.toLowerCase().includes(s) ||
          ep.group.toLowerCase().includes(s),
      );
    }

    const page = (query.page as number) ?? 1;
    const pageSize = (query.pageSize as number) ?? 200;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      items: items.map((ep) => ({
        id: ep.id,
        method: ep.method,
        path: ep.path,
        name: ep.name,
        group: ep.group,
        tags: ep.tags,
        authRequired: ep.auth.length > 0,
      })),
      total: filtered.length,
      page,
      pageSize,
    };
  });

  ipcMain.handle("endpoints:get", async (_event: IpcMainInvokeEvent, raw: unknown) => {
    const endpointId = String(raw);
    const result = await findEndpointWithBaseUrl(db, repo, endpointId);
    if (!result) return null;
    return { ...result.endpoint, overrides: {} };
  });

  ipcMain.handle(
    "endpoints:generateRequest",
    async (_event: IpcMainInvokeEvent, raw: unknown) => {
      const input = raw as Record<string, unknown>;
      const endpointId = String(input.endpointId);
      const result = await findEndpointWithBaseUrl(db, repo, endpointId);
      if (!result) throw new Error(`Endpoint ${endpointId} not found`);

      const { endpoint, baseUrl } = result;
      const generated = generateRequest(endpoint, baseUrl);

      return {
        method: generated.method,
        url: generated.url,
        headers: generated.headers,
        params: generated.params,
        body: generated.body,
        generationInfo: generated.generationInfo.map((gi) => ({
          ...gi,
          reproducible: true,
        })),
      };
    },
  );

  ipcMain.handle(
    "endpoints:send",
    async (_event: IpcMainInvokeEvent, raw: unknown) => {
      const input = raw as Record<string, unknown>;
      const endpointId = String(input.endpointId);
      const result = await findEndpointWithBaseUrl(db, repo, endpointId);
      if (!result) throw new Error(`Endpoint ${endpointId} not found`);

      const { endpoint, baseUrl, projectId } = result;
      const generated = generateRequest(endpoint, baseUrl);

      // Smart resolve: auto-fetch real IDs from list endpoints
      const resolver = new ParamResolver(db);
      const sessionCookie = getSessionCookie(baseUrl);
      const resolvedIds = await resolver.resolveParams(endpoint, baseUrl, projectId, sessionCookie || undefined);

      // Apply overrides if provided
      const overrides = input.overrides as Record<string, unknown> | undefined;
      const finalHeaders = { ...generated.headers, ...(overrides?.headers as Record<string, string> ?? {}) };
      const finalParams = { ...generated.params, ...resolvedIds, ...(overrides?.params as Record<string, string> ?? {}) };
      const finalBody = overrides?.body ?? generated.body;

      // Inject session cookies if available
      if (sessionCookie) {
        finalHeaders["Cookie"] = sessionCookie;
      }

      // Use generated.url which already has correct baseUrl + path
      let url = generated.url;
      for (const [key, val] of Object.entries(finalParams)) {
        url = url.replace(`{${key}}`, encodeURIComponent(val));
      }
      const pathParamNames = endpoint.parameters
        .filter((p) => p.location === "path")
        .map((p) => p.name);
      const queryParams = Object.entries(finalParams).filter(([k]) => !pathParamNames.includes(k));
      if (queryParams.length > 0) {
        url += "?" + queryParams.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      }

      const startTime = Date.now();
      try {
        const response = await net.fetch(url, {
          method: generated.method,
          headers: finalHeaders,
          body: finalBody ? JSON.stringify(finalBody) : undefined,
        });

        const duration = Date.now() - startTime;
        const contentType = response.headers.get("content-type") ?? "";
        const bodyText = await response.text();

        const respHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          respHeaders[key] = value;
        });

        return {
          statusCode: response.status,
          statusText: response.statusText,
          headers: respHeaders,
          cookies: {} as Record<string, string>,
          body: bodyText,
          bodyTruncated: false,
          contentType,
          responseTimeMs: duration,
          responseSize: bodyText.length,
          assertions: [],
          extractedValues: [],
        };
      } catch (err) {
        return {
          statusCode: 0,
          statusText: "Network Error",
          headers: {} as Record<string, string>,
          cookies: {} as Record<string, string>,
          body: String(err),
          bodyTruncated: false,
          contentType: "text/plain",
          responseTimeMs: Date.now() - startTime,
          responseSize: 0,
          assertions: [],
          extractedValues: [],
        };
      }
    },
  );

  // Toggle endpoint selection
  ipcMain.handle("endpoints:toggleSelect", async (_event: IpcMainInvokeEvent, raw: unknown) => {
    const input = raw as Record<string, unknown>;
    const endpointId = String(input.endpointId);
    const selected = Boolean(input.selected);
    await repo.setSelected([endpointId], selected);
    return { success: true };
  });

  // Get selected endpoints
  ipcMain.handle("endpoints:getSelected", async (_event: IpcMainInvokeEvent, raw: unknown) => {
    const projectId = String(raw);
    const selected = await repo.getSelected(projectId);
    return selected.map((ep) => ({
      id: ep.id,
      method: ep.method,
      path: ep.path,
      name: ep.name,
      group: ep.group,
      tags: ep.tags,
    }));
  });

  // List endpoints sorted by source modification time
  ipcMain.handle("endpoints:listByModifiedTime", async (_event: IpcMainInvokeEvent, raw: unknown) => {
    const projectId = String(raw);
    const endpoints = await repo.listByModifiedTime(projectId);
    return endpoints.map((ep) => ({
      id: ep.id,
      method: ep.method,
      path: ep.path,
      name: ep.name,
      group: ep.group,
      tags: ep.tags,
      lastTestedAt: ep.source?.fileModifiedAt,
    }));
  });

  // Batch test selected endpoints — with smart param resolution
  ipcMain.handle("endpoints:batchTest", async (_event: IpcMainInvokeEvent, raw: unknown) => {
    const input = raw as Record<string, unknown>;
    const endpointIds = input.endpointIds as string[];
    if (!endpointIds || endpointIds.length === 0) {
      return { success: false, error: "No endpoints selected" };
    }

    const results: Array<{ endpointId: string; success: boolean; statusCode?: number; error?: string; responseTimeMs?: number }> = [];
    // Collected IDs from list endpoints, keyed by entity type (e.g. "case", "rule")
    const collectedIds = new Map<string, string[]>();

    const llmConfig = getDefaultLLMConfig();
    const llm = llmConfig ? createLLMGenerator(llmConfig) : undefined;
    const resolver = new ParamResolver(db);

    for (const endpointId of endpointIds) {
      try {
        const result = await findEndpointWithBaseUrl(db, repo, endpointId);
        if (!result) {
          results.push({ endpointId, success: false, error: "Endpoint not found" });
          continue;
        }

        const { endpoint, baseUrl, projectId } = result;
        const generated = generateRequest(endpoint, baseUrl);

        const sessionCookie = getSessionCookie(baseUrl);

        // Step 1: Smart resolve — call list endpoints to get real IDs
        const resolvedIds = await resolver.resolveParams(
          endpoint, baseUrl, projectId, sessionCookie || undefined,
        );

        // Step 2: For remaining unresolved params, try collected IDs from previous responses
        const chainedIds: Record<string, string> = {};
        for (const param of endpoint.parameters) {
          if (param.location !== "path" && param.location !== "query") continue;
          if (resolvedIds[param.name]) continue; // already resolved
          const lowerName = param.name.toLowerCase();
          for (const [entityType, ids] of collectedIds) {
            if (lowerName.includes(entityType) && ids.length > 0) {
              chainedIds[param.name] = ids[0];
              break;
            }
          }
        }

        // Step 3: For still-unresolved params, ask LLM
        let llmValues: Record<string, string> = {};
        if (llm) {
          const resolved = new Set([...Object.keys(resolvedIds), ...Object.keys(chainedIds)]);
          const unresolvedParams = endpoint.parameters.filter(
            (p) => (p.location === "path" || p.location === "query") && !resolved.has(p.name),
          );
          if (unresolvedParams.length > 0) {
            const ctx: EndpointContext = {
              method: endpoint.method,
              path: endpoint.path,
              name: endpoint.name,
              group: endpoint.group,
              tags: endpoint.tags,
              parameters: endpoint.parameters,
            };
            llmValues = (await llm.generateValues(ctx, unresolvedParams)) ?? {};
          }
        }

        // Merge: resolved IDs (from list API) > chained IDs (from prev response) > LLM > defaults
        const mergedParams = { ...generated.params, ...llmValues, ...chainedIds, ...resolvedIds };

        // Apply user overrides
        const overrides = input.overrides as Record<string, unknown> | undefined;
        const finalHeaders = { ...generated.headers, ...(overrides?.headers as Record<string, string> ?? {}) };
        const finalParams = { ...mergedParams, ...(overrides?.params as Record<string, string> ?? {}) };
        const finalBody = overrides?.body ?? generated.body;

        if (sessionCookie) {
          finalHeaders["Cookie"] = sessionCookie;
        }

        let url = generated.url.split("?")[0];
        for (const [key, val] of Object.entries(finalParams)) {
          url = url.replace(`{${key}}`, encodeURIComponent(val));
        }
        const pathParamNames = endpoint.parameters.filter((p) => p.location === "path").map((p) => p.name);
        const queryParams = Object.entries(finalParams).filter(([k]) => !pathParamNames.includes(k));
        if (queryParams.length > 0) {
          url += "?" + queryParams.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
        }

        const startTime = Date.now();
        const response = await net.fetch(url, {
          method: generated.method,
          headers: finalHeaders,
          body: finalBody ? JSON.stringify(finalBody) : undefined,
        });
        const duration = Date.now() - startTime;

        const success = response.status >= 200 && response.status < 300;
        results.push({
          endpointId,
          success,
          statusCode: response.status,
          responseTimeMs: duration,
        });

        // Collect IDs from successful list responses for chaining
        if (success) {
          try {
            const body = await response.json() as unknown;
            collectIdsFromResponse(body, collectedIds, endpoint);
          } catch {
            // Not JSON or no IDs — fine
          }
        }

        await repo.updateLastTested(endpointId, success ? "passed" : "failed", `Status: ${response.status}`);
      } catch (err) {
        results.push({
          endpointId,
          success: false,
          error: String(err),
        });
        await repo.updateLastTested(endpointId, "error", String(err));
      }
    }

    const passed = results.filter((r) => r.success).length;
    const failed = results.length - passed;

    return {
      success: true,
      results,
      summary: { total: results.length, passed, failed },
    };
  });
}

/** Extract entity IDs from a list response body for use in subsequent detail endpoints. */
function collectIdsFromResponse(
  body: unknown,
  collectedIds: Map<string, string[]>,
  endpoint: NormalizedEndpoint,
): void {
  if (!body || typeof body !== "object") return;

  // Determine entity type from endpoint path/group
  const path = endpoint.path.toLowerCase();
  const group = (endpoint.group ?? "").toLowerCase();

  // Common entity type patterns: /cases → "case", /rules → "rule", etc.
  const entityType = extractEntityType(path) ?? extractEntityType(group);
  if (!entityType) return;

  // Try common response shapes: { data: [...] }, { records: [...] }, { list: [...] }, or array root
  const arrays: unknown[][] = [];
  const obj = body as Record<string, unknown>;
  if (Array.isArray(obj)) {
    arrays.push(obj);
  } else {
    for (const key of ["data", "records", "list", "items", "content", "rows"]) {
      if (Array.isArray(obj[key])) {
        arrays.push(obj[key] as unknown[]);
      }
    }
  }

  const ids: string[] = [];
  for (const arr of arrays) {
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      // Try common ID field names
      const id = String(record["id"] ?? record["caseId"] ?? record["ruleId"] ?? record["Id"] ?? "");
      if (id) ids.push(id);
    }
  }

  if (ids.length > 0) {
    const existing = collectedIds.get(entityType) ?? [];
    collectedIds.set(entityType, [...existing, ...ids]);
  }
}

/** Extract entity type from a path segment like "/cases" → "case", "/case-reviews" → "case" */
function extractEntityType(segment: string): string | null {
  const patterns: Array<{ re: RegExp; type: string }> = [
    { re: /case|案卷|aj/, type: "case" },
    { re: /rule|规则|评分|gz/, type: "rule" },
    { re: /user|用户|yh/, type: "user" },
    { re: /org|单位|机构|dw/, type: "org" },
    { re: /review|评审|评查|pc/, type: "review" },
  ];
  for (const { re, type } of patterns) {
    if (re.test(segment)) return type;
  }
  return null;
}
