import type { Kysely } from "kysely";
import type { NormalizedEndpoint, EndpointId } from "@reqsmith/contracts";
import type { Database } from "./types.js";

export class EndpointRepository {
  constructor(private db: Kysely<Database>) {}

  async replaceForProject(projectId: string, endpoints: NormalizedEndpoint[]): Promise<number> {
    await this.db.deleteFrom("endpoint").where("project_id", "=", projectId).execute();

    if (endpoints.length === 0) return 0;

    const rows = endpoints.map((ep) => ({
      id: ep.id,
      project_id: projectId,
      method: ep.method,
      path: ep.path,
      name: ep.name,
      group_name: ep.group,
      tags: JSON.stringify(ep.tags),
      parameters: JSON.stringify(ep.parameters),
      request_body: ep.requestBody ? JSON.stringify(ep.requestBody) : null,
      responses: JSON.stringify(ep.responses),
      auth: JSON.stringify(ep.auth),
      source_json: ep.source ? JSON.stringify(ep.source) : null,
      fingerprint: ep.fingerprint,
      scan_run_id: null as string | null,
      source_file_modified_at: ep.source?.fileModifiedAt ? new Date(ep.source.fileModifiedAt).toISOString() : null,
      source_method_line: ep.source?.methodLine ?? null,
      source_class_line: ep.source?.classLine ?? null,
      selected: 0,
      last_tested_at: null,
      last_test_status: null,
      last_test_message: null,
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      await this.db.insertInto("endpoint").values(batch).execute();
    }

    return endpoints.length;
  }

  async listByProject(projectId: string): Promise<NormalizedEndpoint[]> {
    const rows = await this.db
      .selectFrom("endpoint")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("group_name", "asc")
      .orderBy("path", "asc")
      .orderBy("method", "asc")
      .execute();

    return rows.map(fromRow);
  }

  async countByProject(projectId: string): Promise<number> {
    const row = await this.db
      .selectFrom("endpoint")
      .select(({ fn }) => fn.count<number>("id").as("cnt"))
      .where("project_id", "=", projectId)
      .executeTakeFirst();

    return row?.cnt ?? 0;
  }

  async setSelected(endpointIds: string[], selected: boolean): Promise<void> {
    for (const id of endpointIds) {
      await this.db.updateTable("endpoint").set({ selected: selected ? 1 : 0 }).where("id", "=", id).execute();
    }
  }

  async getSelected(projectId: string): Promise<NormalizedEndpoint[]> {
    const rows = await this.db
      .selectFrom("endpoint")
      .selectAll()
      .where("project_id", "=", projectId)
      .where("selected", "=", 1)
      .execute();
    return rows.map(fromRow);
  }

  async updateLastTested(endpointId: string, status: string, message?: string): Promise<void> {
    await this.db
      .updateTable("endpoint")
      .set({
        last_tested_at: new Date().toISOString(),
        last_test_status: status,
        last_test_message: message ?? null,
      })
      .where("id", "=", endpointId)
      .execute();
  }

  async renameAndUpdateGroup(endpointId: string, name: string, group: string): Promise<void> {
    await this.db.updateTable("endpoint").set({ name, group_name: group }).where("id", "=", endpointId).execute();
  }

  async listByModifiedTime(projectId: string): Promise<NormalizedEndpoint[]> {
    const rows = await this.db
      .selectFrom("endpoint")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("source_file_modified_at", "desc")
      .orderBy("source_method_line", "asc")
      .orderBy("path", "asc")
      .execute();
    return rows.map(fromRow);
  }
}

interface EndpointRow {
  id: string;
  project_id: string;
  method: string;
  path: string;
  name: string;
  group_name: string;
  tags: string;
  parameters: string;
  request_body: string | null;
  responses: string;
  auth: string;
  source_json: string | null;
  fingerprint: string;
  scan_run_id: string | null;
  source_file_modified_at: string | null;
  source_method_line: number | null;
  source_class_line: number | null;
  selected: number;
  last_tested_at: string | null;
  last_test_status: string | null;
  last_test_message: string | null;
}

function fromRow(r: EndpointRow): NormalizedEndpoint {
  const src = r.source_json ? JSON.parse(r.source_json) : null;
  return {
    id: r.id as EndpointId,
    projectId: r.project_id,
    method: r.method as NormalizedEndpoint["method"],
    path: r.path,
    name: r.name,
    group: r.group_name,
    tags: JSON.parse(r.tags),
    parameters: JSON.parse(r.parameters),
    requestBody: r.request_body ? JSON.parse(r.request_body) : undefined,
    responses: JSON.parse(r.responses),
    auth: JSON.parse(r.auth),
    source: src ? {
      filePath: src.filePath ?? "",
      relativePath: src.relativePath ?? "",
      startLine: src.startLine ?? 0,
      endLine: src.endLine ?? 0,
      className: src.className ?? "",
      methodName: src.methodName ?? "",
      fingerprint: r.fingerprint,
      fileModifiedAt: r.source_file_modified_at ? new Date(r.source_file_modified_at).getTime() : undefined,
      methodLine: r.source_method_line ?? undefined,
      classLine: r.source_class_line ?? undefined,
    } : undefined,
    fingerprint: r.fingerprint,
  };
}

export interface TestResult {
  id: string;
  endpointId: string;
  status: string;
  statusCode?: number;
  responseTimeMs?: number;
  responseBody?: string;
  errorMessage?: string;
  createdAt: string;
}

export class TestResultRepository {
  constructor(private db: Kysely<Database>) {}

  async save(result: Omit<TestResult, "id" | "createdAt">): Promise<string> {
    const id = `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.db.insertInto("test_result").values({
      id,
      endpoint_id: result.endpointId,
      status: result.status,
      status_code: result.statusCode ?? null,
      response_time_ms: result.responseTimeMs ?? null,
      response_body: result.responseBody ?? null,
      error_message: result.errorMessage ?? null,
      created_at: new Date().toISOString(),
    }).execute();
    return id;
  }

  async listByEndpoint(endpointId: string, limit = 10): Promise<TestResult[]> {
    const rows = await this.db
      .selectFrom("test_result")
      .selectAll()
      .where("endpoint_id", "=", endpointId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute();
    return rows.map((r) => ({
      id: r.id,
      endpointId: r.endpoint_id,
      status: r.status,
      statusCode: r.status_code ?? undefined,
      responseTimeMs: r.response_time_ms ?? undefined,
      responseBody: r.response_body ?? undefined,
      errorMessage: r.error_message ?? undefined,
      createdAt: r.created_at,
    }));
  }
}