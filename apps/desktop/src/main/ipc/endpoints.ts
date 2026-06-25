import { ipcMain, type IpcMainInvokeEvent, net } from "electron";
import type { Kysely } from "kysely";
import type { Database } from "@reqsmith/persistence";
import { EndpointRepository } from "@reqsmith/persistence";
import type { NormalizedEndpoint } from "@reqsmith/contracts";
import { ProjectIdSchema } from "@reqsmith/contracts";
import { generateRequest } from "@reqsmith/data-generator";

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
): Promise<{ endpoint: NormalizedEndpoint; baseUrl: string } | null> {
  const allProjects = await db.selectFrom("project").select(["id", "base_url"]).execute();
  for (const p of allProjects) {
    const endpoints = await repo.listByProject(p.id);
    const found = endpoints.find((ep) => ep.id === endpointId);
    if (found) {
      return { endpoint: found, baseUrl: p.base_url || "http://localhost:8080" };
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

      const { endpoint, baseUrl } = result;
      const generated = generateRequest(endpoint, baseUrl);

      // Apply overrides if provided
      const overrides = input.overrides as Record<string, unknown> | undefined;
      const finalHeaders = { ...generated.headers, ...(overrides?.headers as Record<string, string> ?? {}) };
      const finalParams = { ...generated.params, ...(overrides?.params as Record<string, string> ?? {}) };
      const finalBody = overrides?.body ?? generated.body;

      // Inject session cookies if available
      const sessionCookie = getSessionCookie(baseUrl);
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

  // Batch test selected endpoints
  ipcMain.handle("endpoints:batchTest", async (_event: IpcMainInvokeEvent, raw: unknown) => {
    const input = raw as Record<string, unknown>;
    const endpointIds = input.endpointIds as string[];
    if (!endpointIds || endpointIds.length === 0) {
      return { success: false, error: "No endpoints selected" };
    }

    const results: Array<{ endpointId: string; success: boolean; statusCode?: number; error?: string; responseTimeMs?: number }> = [];

    for (const endpointId of endpointIds) {
      try {
        const result = await findEndpointWithBaseUrl(db, repo, endpointId);
        if (!result) {
          results.push({ endpointId, success: false, error: "Endpoint not found" });
          continue;
        }

        const { endpoint, baseUrl } = result;
        const generated = generateRequest(endpoint, baseUrl);

        // Apply overrides
        const overrides = input.overrides as Record<string, unknown> | undefined;
        const finalHeaders = { ...generated.headers, ...(overrides?.headers as Record<string, string> ?? {}) };
        const finalParams = { ...generated.params, ...(overrides?.params as Record<string, string> ?? {}) };
        const finalBody = overrides?.body ?? generated.body;

        const sessionCookie = getSessionCookie(baseUrl);
        if (sessionCookie) {
          finalHeaders["Cookie"] = sessionCookie;
        }

        let url = generated.url;
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

        // Update last test status in DB
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
