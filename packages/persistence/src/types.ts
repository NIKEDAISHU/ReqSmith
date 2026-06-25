import type { Generated } from "kysely";

export interface ProjectTable {
  id: Generated<string>;
  name: string;
  description: string | null;
  source_type: string;
  source_path: string | null;
  source_url: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
  last_scan_at: string | null;
  base_url: string | null;
}

export interface ScanSourceTable {
  id: Generated<string>;
  project_id: string;
  type: string;
  path: string | null;
  url: string | null;
  created_at: Generated<string>;
}

export interface EndpointTable {
  id: Generated<string>;
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
  created_at: Generated<string>;
  updated_at: Generated<string>;
  source_file_modified_at: string | null;
  source_method_line: number | null;
  source_class_line: number | null;
  selected: number;
  last_tested_at: string | null;
  last_test_status: string | null;
  last_test_message: string | null;
}

export interface TestResultTable {
  id: Generated<string>;
  endpoint_id: string;
  status: string;
  status_code: number | null;
  response_time_ms: number | null;
  response_body: string | null;
  error_message: string | null;
  created_at: Generated<string>;
}

export interface Database {
  project: ProjectTable;
  scan_source: ScanSourceTable;
  endpoint: EndpointTable;
  test_result: TestResultTable;
}

