import { Migrator, type MigrationProvider, type Migration } from "kysely";
import { migration001 } from "./migrations/001_project.js";
import { migration002 } from "./migrations/002_endpoint.js";
import { migration003 } from "./migrations/003_project_base_url.js";
import { migration004 } from "./migrations/004_endpoint_extended.js";

const migrations: Record<string, Migration> = {
  "001_project": migration001,
  "002_endpoint": migration002,
  "003_project_base_url": migration003,
  "004_endpoint_extended": migration004,
};

export class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}

export async function migrateToLatest(db: { migration: Migrator }): Promise<void> {
  const { results, error } = await db.migration.migrateToLatest();
  if (error) throw error;
  results?.forEach((r) => {
    if (r.status === "Success") {
      console.log(`migration "${r.migrationName}" executed successfully`);
    } else if (r.status === "Error") {
      console.error(`migration "${r.migrationName}" failed`);
    }
  });
}
