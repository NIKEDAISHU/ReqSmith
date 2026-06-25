import { net } from "electron";
import type { Kysely } from "kysely";
import type { NormalizedEndpoint, EndpointParameter } from "@reqsmith/contracts";
import type { Database } from "@reqsmith/persistence";
import { EndpointRepository } from "@reqsmith/persistence";

/** Resolve ID-like parameters by calling list endpoints and extracting real values. */
export class ParamResolver {
  private repo: EndpointRepository;
  /** Cache: entityType → [extracted IDs] */
  private idCache = new Map<string, string[]>();

  constructor(db: Kysely<Database>) {
    this.repo = new EndpointRepository(db);
  }

  /**
   * For each ID-like parameter, try to find a real value by:
   * 1. Checking the cache
   * 2. Finding a matching list endpoint in the same project
   * 3. Calling it and extracting IDs from the response
   */
  async resolveParams(
    endpoint: NormalizedEndpoint,
    baseUrl: string,
    projectId: string,
    sessionCookie?: string,
  ): Promise<Record<string, string>> {
    const resolved: Record<string, string> = {};

    for (const param of endpoint.parameters) {
      if (param.location !== "path" && param.location !== "query") continue;

      const entityType = this.detectEntityType(param, endpoint);
      if (!entityType) continue;

      // Check cache first
      let ids = this.idCache.get(entityType);
      if (!ids || ids.length === 0) {
        ids = await this.fetchIdsFromListEndpoint(entityType, baseUrl, projectId, sessionCookie);
      }

      if (ids && ids.length > 0) {
        resolved[param.name] = ids[0];
      }
    }

    return resolved;
  }

  /** Detect what "entity type" a parameter refers to based on naming patterns. */
  private detectEntityType(param: EndpointParameter, endpoint: NormalizedEndpoint): string | null {
    const name = param.name.toLowerCase();
    const path = endpoint.path.toLowerCase();

    // Common ID parameter patterns
    const patterns: Array<{ re: RegExp; entity: string }> = [
      { re: /caseid|ajid|案卷id|case_id/, entity: "case" },
      { re: /ruleid|gzid|规则id|rule_id/, entity: "rule" },
      { re: /userid|yhid|用户id|user_id/, entity: "user" },
      { re: /orgid|dwid|单位id|org_id/, entity: "org" },
      { re: /reviewid|pcid|评审id|review_id/, entity: "review" },
      { re: /litigantid|当事人id/, entity: "litigant" },
      { re: /penaltyid|处罚id/, entity: "penalty" },
      { re: /documentid|文书id|docid/, entity: "document" },
    ];

    for (const { re, entity } of patterns) {
      if (re.test(name)) return entity;
    }

    // If param is just "id" — infer entity from path segments
    if (name === "id") {
      const segments = path.split("/").filter(Boolean);
      const skip = new Set(["detail", "list", "api", "create", "update", "delete", "query", "page", "export", "import", "count"]);
      for (const seg of segments) {
        if (!skip.has(seg) && !/^\{/.test(seg) && seg.length > 1) {
          return seg;
        }
      }
    }

    return null;
  }

  /** Find and call a list endpoint to extract entity IDs. */
  private async fetchIdsFromListEndpoint(
    entityType: string,
    baseUrl: string,
    projectId: string,
    sessionCookie?: string,
  ): Promise<string[]> {
    const listEndpoints = await this.findListEndpoints(entityType, projectId);
    if (listEndpoints.length === 0) return [];

    for (const listEp of listEndpoints) {
      try {
        const url = `${baseUrl}${listEp.path}`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (sessionCookie) headers["Cookie"] = sessionCookie;

        const response = await net.fetch(url, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) continue;

        const body = await response.json() as unknown;
        const ids = this.extractIdsFromResponse(body);
        if (ids.length > 0) {
          this.idCache.set(entityType, ids);
          return ids;
        }
      } catch {
        continue;
      }
    }

    return [];
  }

  /** Find list endpoints in the same project that match the entity type. */
  private async findListEndpoints(entityType: string, projectId: string): Promise<NormalizedEndpoint[]> {
    const allEndpoints = await this.repo.listByProject(projectId);
    const entityPlural = entityType + "s";

    return allEndpoints.filter((ep) => {
      if (ep.method !== "GET") return false;
      const path = ep.path.toLowerCase();
      return (
        (path.includes(`/${entityType}/`) && (path.includes("list") || path.includes("page") || path.includes("query"))) ||
        path.includes(`/${entityPlural}`) ||
        path === `/${entityType}`
      );
    });
  }

  /** Extract ID values from a list response body. */
  private extractIdsFromResponse(body: unknown): string[] {
    if (!body || typeof body !== "object") return [];

    const obj = body as Record<string, unknown>;
    const arrays: unknown[][] = [];
    if (Array.isArray(obj)) {
      arrays.push(obj);
    } else {
      for (const key of ["data", "records", "list", "items", "content", "rows", "result"]) {
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
        const id = record["id"] ?? record["caseId"] ?? record["Id"] ?? record["ID"] ?? "";
        if (id !== "" && id !== null && id !== undefined) {
          ids.push(String(id));
        }
      }
    }

    return ids;
  }
}
