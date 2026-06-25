import { sql, type Migration } from "kysely";

export const migration001: Migration = {
  up: async (db) => {
    await db.schema
      .createTable("project")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("description", "text")
      .addColumn("source_type", "text", (col) => col.notNull())
      .addColumn("source_path", "text")
      .addColumn("source_url", "text")
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("last_scan_at", "text")
      .execute();

    await db.schema
      .createTable("scan_source")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("project_id", "text", (col) => col.notNull().references("project.id").onDelete("cascade"))
      .addColumn("type", "text", (col) => col.notNull())
      .addColumn("path", "text")
      .addColumn("url", "text")
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createIndex("idx_scan_source_project_id")
      .on("scan_source")
      .column("project_id")
      .execute();
  },
  down: async (db) => {
    await db.schema.dropTable("scan_source").ifExists().execute();
    await db.schema.dropTable("project").ifExists().execute();
  },
};
