import type { Migration } from "kysely";

export const migration003: Migration = {
  up: async (db) => {
    await db.schema
      .alterTable("project")
      .addColumn("base_url", "text")
      .execute();
  },
  down: async () => {
    // SQLite doesn't support DROP COLUMN in older versions
  },
};
