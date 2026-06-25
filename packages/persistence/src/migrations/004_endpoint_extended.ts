import { sql, type Migration } from "kysely";

export const migration004: Migration = {
  up: async (db) => {
    // Add source code location for sorting by modification time
    // SQLite doesn't support multiple ADD COLUMN in one ALTER TABLE — must split
    await db.schema.alterTable("endpoint").addColumn("source_file_modified_at", "text").execute();
    await db.schema.alterTable("endpoint").addColumn("source_method_line", "integer").execute();
    await db.schema.alterTable("endpoint").addColumn("source_class_line", "integer").execute();

    // Add fields for multi-select and testing
    await db.schema.alterTable("endpoint").addColumn("selected", "integer", (col) => col.notNull().defaultTo(0)).execute();
    await db.schema.alterTable("endpoint").addColumn("last_tested_at", "text").execute();
    await db.schema.alterTable("endpoint").addColumn("last_test_status", "text").execute();
    await db.schema.alterTable("endpoint").addColumn("last_test_message", "text").execute();

    // Create index for sorting by source modification time
    await db.schema
      .createIndex("idx_endpoint_source_modified")
      .on("endpoint")
      .column("source_file_modified_at")
      .execute();

    // Create test_results table for batch testing
    await db.schema
      .createTable("test_result")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("endpoint_id", "text", (col) => col.notNull().references("endpoint.id").onDelete("cascade"))
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("status_code", "integer")
      .addColumn("response_time_ms", "integer")
      .addColumn("response_body", "text")
      .addColumn("error_message", "text")
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createIndex("idx_test_result_endpoint_id")
      .on("test_result")
      .column("endpoint_id")
      .execute();

    await db.schema
      .createIndex("idx_test_result_created_at")
      .on("test_result")
      .column("created_at")
      .execute();
  },
  down: async (db) => {
    await db.schema.dropTable("test_result").ifExists().execute();
    await db.schema.alterTable("endpoint").dropColumn("source_file_modified_at").execute();
    await db.schema.alterTable("endpoint").dropColumn("source_method_line").execute();
    await db.schema.alterTable("endpoint").dropColumn("source_class_line").execute();
    await db.schema.alterTable("endpoint").dropColumn("selected").execute();
    await db.schema.alterTable("endpoint").dropColumn("last_tested_at").execute();
    await db.schema.alterTable("endpoint").dropColumn("last_test_status").execute();
    await db.schema.alterTable("endpoint").dropColumn("last_test_message").execute();
  },
};
