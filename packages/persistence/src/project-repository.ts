import type { Kysely } from "kysely";
import type { Project, ProjectSummary, CreateProjectInput, UpdateProjectInput, ProjectId } from "@reqsmith/contracts";
import type { ProjectRepository } from "@reqsmith/domain";
import type { Database } from "./types.js";

function toProjectId(id: string): ProjectId {
  return id as ProjectId;
}

function toSourceType(s: string): Project["sourceType"] {
  return s as Project["sourceType"];
}

export class ProjectRepositoryImpl implements ProjectRepository {
  constructor(private db: Kysely<Database>) {}

  async list(): Promise<ProjectSummary[]> {
    const rows = await this.db
      .selectFrom("project")
      .select((eb) => [
        "id",
        "name",
        "source_type",
        "updated_at",
        "last_scan_at",
        eb.selectFrom("endpoint")
          .whereRef("endpoint.project_id", "=", "project.id")
          .select(({ fn }) => fn.count<number>("endpoint.id").as("cnt"))
          .as("endpoint_count"),
      ])
      .orderBy("updated_at", "desc")
      .execute();

    return rows.map((r) => ({
      id: toProjectId(r.id),
      name: r.name,
      sourceType: toSourceType(r.source_type),
      endpointCount: (r as Record<string, unknown>).endpoint_count as number ?? 0,
      lastScanAt: r.last_scan_at ?? undefined,
      updatedAt: r.updated_at,
    }));
  }

  async get(id: ProjectId): Promise<Project | null> {
    const row = await this.db
      .selectFrom("project")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: toProjectId(row.id),
      name: row.name,
      description: row.description ?? undefined,
      sourceType: toSourceType(row.source_type),
      sourcePath: row.source_path ?? undefined,
      sourceUrl: row.source_url ?? undefined,
      baseUrl: row.base_url ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastScanAt: row.last_scan_at ?? undefined,
    };
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const id = toProjectId(crypto.randomUUID());
    const now = new Date().toISOString().replace(/\.\d+Z$/, ".000Z");

    await this.db
      .insertInto("project")
      .values({
        id,
        name: input.name,
        description: input.description ?? null,
        source_type: input.sourceType,
        source_path: input.sourcePath ?? null,
        source_url: input.sourceUrl ?? null,
        created_at: now,
        updated_at: now,
      })
      .execute();

    const project = await this.get(id);
    if (!project) throw new Error("Failed to read back created project");
    return project;
  }

  async update(input: UpdateProjectInput): Promise<Project> {
    const sets: Record<string, string> = {
      updated_at: new Date().toISOString().replace(/\.\d+Z$/, ".000Z"),
    };
    if (input.name !== undefined) sets.name = input.name;
    if (input.description !== undefined) sets.description = input.description;

    await this.db
      .updateTable("project")
      .set(sets)
      .where("id", "=", input.projectId)
      .execute();

    const project = await this.get(input.projectId);
    if (!project) throw new Error(`Project not found: ${input.projectId}`);
    return project;
  }

  async remove(id: ProjectId): Promise<void> {
    await this.db.deleteFrom("project").where("id", "=", id).execute();
  }

  async getEndpointCount(id: ProjectId): Promise<number> {
    const row = await this.db
      .selectFrom("endpoint")
      .select(({ fn }) => fn.count<number>("id").as("cnt"))
      .where("project_id", "=", id)
      .executeTakeFirst();
    return row?.cnt ?? 0;
  }
}
