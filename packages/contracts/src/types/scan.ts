
export type ScanRunId = string & { __brand: "ScanRunId" };

export interface ScanSource {
  type: "directory" | "openapi_file" | "openapi_url";
  path?: string;
  url?: string;
}

export interface ScanContext {
  projectId: string;
  source: ScanSource;
}

export type ScanEventType =
  | "scan.started"
  | "scan.file_parsed"
  | "scan.endpoint_found"
  | "scan.warning"
  | "scan.error"
  | "scan.completed";

export interface ScanEvent {
  type: ScanEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface ScanRun {
  id: ScanRunId;
  projectId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  endpointsFound: number;
  warnings: number;
  errors: number;
}

export interface StartScanInput {
  projectId: string;
  full?: boolean;
}

export interface TaskHandle {
  taskId: string;
  type: "scan" | "run";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
}
