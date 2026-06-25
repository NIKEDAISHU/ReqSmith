export type SuiteId = string & { __brand: "SuiteId" };
export type RunId = string & { __brand: "RunId" };

export type ExecutionMode = "SEQUENTIAL" | "PARALLEL" | "DEPENDENCY_AWARE";
export type FailureStrategy = "CONTINUE" | "STOP_ALL" | "SKIP_DEPENDENTS" | "RETRY_THEN_SKIP";

export interface TestSuite {
  id: SuiteId;
  projectId: string;
  name: string;
  description?: string;
  nodes: TestNode[];
  edges: TestEdge[];
  environmentId?: string;
  executionMode: ExecutionMode;
  failureStrategy: FailureStrategy;
  maxConcurrency: number;
  retryCount: number;
}

export interface TestNode {
  id: string;
  endpointId: string;
  order?: number;
  overrides?: Record<string, unknown>;
}

export interface TestEdge {
  fromNodeId: string;
  toNodeId: string;
  type: "variable_dependency" | "auth_dependency" | "explicit" | "ordering";
  variableName?: string;
}

export interface TestRun {
  id: RunId;
  suiteId: SuiteId;
  environmentId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  totalNodes: number;
  successCount: number;
  failureCount: number;
  skipCount: number;
  cancelCount: number;
}

export type NodeStatus = "queued" | "running" | "success" | "failure" | "skipped" | "cancelled";

export interface TestResult {
  nodeId: string;
  endpointId: string;
  status: NodeStatus;
  statusCode?: number;
  responseTimeMs?: number;
  responseSize?: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
  extractedValues: ExtractedValue[];
  assertionResults: AssertionResult[];
}

export interface ExtractedValue {
  variableName: string;
  source: string;
  jsonPath: string;
  value: string;
}

export interface AssertionResult {
  assertionId: string;
  passed: boolean;
  message?: string;
  expected?: string;
  actual?: string;
}

export interface ExecutionPlan {
  nodes: ExecutionPlanNode[];
  edges: ExecutionPlanEdge[];
  warnings: string[];
}

export interface ExecutionPlanNode {
  nodeId: string;
  endpointId: string;
  dependencies: string[];
  level: number;
}

export interface ExecutionPlanEdge {
  from: string;
  to: string;
  type: string;
}

export interface TestSuiteSummary {
  id: SuiteId;
  name: string;
  nodeCount: number;
  lastRunAt?: string;
  lastRunStatus?: "success" | "failure" | "mixed";
}

export type RunEventType =
  | "run.started"
  | "node.queued"
  | "node.started"
  | "node.completed"
  | "node.failed"
  | "node.skipped"
  | "run.cancelled"
  | "run.completed";

export interface RunEvent {
  type: RunEventType;
  timestamp: string;
  runId: string;
  nodeId?: string;
  data?: Record<string, unknown>;
}
