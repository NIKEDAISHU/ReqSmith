import { sql, type Migration } from "kysely";

export const migration002: Migration = {
  up: async (db) => {
    await db.schema
      .createTable("endpoint")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("project_id", "text", (col) => col.notNull().references("project.id").onDelete("cascade"))
      .addColumn("method", "text", (col) => col.notNull())
      .addColumn("path", "text", (col) => col.notNull())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("group_name", "text", (col) => col.notNull())
      .addColumn("tags", "text", (col) => col.notNull().defaultTo("[]"))
      .addColumn("parameters", "text", (col) => col.notNull().defaultTo("[]"))
      .addColumn("request_body", "text")
      .addColumn("responses", "text", (col) => col.notNull().defaultTo("[]"))
      .addColumn("auth", "text", (col) => col.notNull().defaultTo("[]"))
      .addColumn("source_json", "text")
      .addColumn("fingerprint", "text", (col) => col.notNull())
      .addColumn("scan_run_id", "text")
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createIndex("idx_endpoint_project_id")
      .on("endpoint")
      .column("project_id")
      .execute();

    await db.schema
      .createIndex("idx_endpoint_fingerprint")
      .on("endpoint")
      .columns(["project_id", "fingerprint"])
      .execute();
  },
  down: async (db) => {
    await db.schema.dropTable("endpoint").ifExists().execute();
  },
};
