export interface ProjectIpc {
  list(): Promise<import("./project.js").ProjectSummary[]>;
  create(input: import("./project.js").CreateProjectInput): Promise<import("./project.js").Project>;
  get(projectId: string): Promise<import("./project.js").Project>;
  update(input: import("./project.js").UpdateProjectInput): Promise<import("./project.js").Project>;
  remove(projectId: string): Promise<void>;
  scan(input: import("./scan.js").StartScanInput): Promise<import("./scan.js").TaskHandle>;
  listScanRuns(projectId: string): Promise<import("./scan.js").ScanRun[]>;
}

export interface EndpointIpc {
  list(query: import("./endpoint.js").EndpointQuery): Promise<import("./endpoint.js").Page<import("./endpoint.js").EndpointSummary>>;
  get(endpointId: string): Promise<import("./endpoint.js").EndpointDetail>;
  saveOverride(input: { endpointId: string; fields: Record<string, unknown> }): Promise<void>;
  openSource(location: import("./endpoint.js").SourceLocation): Promise<void>;
  generateRequest(input: { endpointId: string; environmentId: string }): Promise<import("./request.js").GeneratedRequest>;
  send(input: import("./request.js").SendRequestInput): Promise<import("./request.js").RequestResult>;
  toggleSelect(input: { endpointId: string; selected: boolean }): Promise<{ success: boolean }>;
  getSelected(projectId: string): Promise<Array<{ id: string; method: string; path: string; name: string; group: string; tags: string[] }>>;
  listByModifiedTime(projectId: string): Promise<Array<{ id: string; method: string; path: string; name: string; group: string; tags: string[]; lastTestedAt?: number }>>;
  batchTest(input: { endpointIds: string[]; overrides?: Record<string, unknown> }): Promise<{ success: boolean; results: Array<{ endpointId: string; success: boolean; statusCode?: number; error?: string; responseTimeMs?: number }>; summary: { total: number; passed: number; failed: number } }>;
  batchRename(input: { renames: Array<{ id: string; name: string; group: string }> }): Promise<{ success: boolean; count?: number }>;
}

export interface SuiteIpc {
  list(projectId: string): Promise<import("./test.js").TestSuiteSummary[]>;
  create(input: { projectId: string; name: string; description?: string }): Promise<import("./test.js").TestSuite>;
  get(suiteId: string): Promise<import("./test.js").TestSuite>;
  update(input: { suiteId: string; name?: string; nodes?: import("./test.js").TestNode[]; edges?: import("./test.js").TestEdge[] }): Promise<import("./test.js").TestSuite>;
  remove(suiteId: string): Promise<void>;
  plan(input: { suiteId: string; environmentId: string }): Promise<import("./test.js").ExecutionPlan>;
}

export interface RunIpc {
  start(input: { suiteId: string; environmentId: string; failureStrategy?: import("./test.js").FailureStrategy }): Promise<import("./scan.js").TaskHandle>;
  get(runId: string): Promise<import("./test.js").TestRun>;
  cancel(runId: string): Promise<void>;
  retryFailed(runId: string): Promise<import("./scan.js").TaskHandle>;
}

export interface ReqSmithIpc {
  projects: ProjectIpc;
  endpoints: EndpointIpc;
  suites: SuiteIpc;
  runs: RunIpc;
}
