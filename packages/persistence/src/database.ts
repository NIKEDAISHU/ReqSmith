import Database from "better-sqlite3";
import { Kysely, SqliteDialect, Migrator } from "kysely";
import { StaticMigrationProvider, migrateToLatest } from "./migrator.js";
import type { Database as DatabaseSchema } from "./types.js";

export function createDatabase(dbPath: string): Kysely<DatabaseSchema> {
  const dialect = new SqliteDialect({
    database: new Database(dbPath),
  });

  const db = new Kysely<DatabaseSchema>({ dialect });

  // Run migrations on creation
  const migrator = new Migrator({
    db,
    provider: new StaticMigrationProvider(),
  });

  // Fire-and-forget migration; callers should use initDatabase() for safe startup
  migrateToLatest({ migration: migrator }).catch((err) => {
    console.error("Migration failed:", err);
    throw err;
  });

  return db;
}

export async function initDatabase(dbPath: string): Promise<Kysely<DatabaseSchema>> {
  const dialect = new SqliteDialect({
    database: new Database(dbPath),
  });

  const db = new Kysely<DatabaseSchema>({ dialect });

  const migrator = new Migrator({
    db,
    provider: new StaticMigrationProvider(),
  });

  await migrateToLatest({ migration: migrator });
  return db;
}

export type { DatabaseSchema };
