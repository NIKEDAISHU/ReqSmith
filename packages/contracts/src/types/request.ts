export type AuthType =
  | "none" | "basic" | "bearer"
  | "api_key_header" | "api_key_query"
  | "cookie" | "login_request";

export interface AuthConfig {
  type: AuthType;
  username?: string;
  password?: string;
  token?: string;
  headerName?: string;
  headerPrefix?: string;
  queryName?: string;
  cookieName?: string;
  loginEndpointId?: string;
  tokenJsonPath?: string;
  refreshTokenJsonPath?: string;
  expiresInJsonPath?: string;
  fixedExpiresInSeconds?: number;
}

export interface GeneratedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  body?: unknown;
  auth?: AuthConfig;
  generationInfo: GenerationInfo[];
}

export interface GenerationInfo {
  field: string;
  generatorId: string;
  reason: string;
  sourceConstraint?: string;
  confidence: number;
  reproducible: boolean;
}

export interface SendRequestInput {
  endpointId: string;
  environmentId: string;
  overrides?: {
    params?: Record<string, string>;
    headers?: Record<string, string>;
    body?: unknown;
    auth?: AuthConfig;
  };
}

export interface RequestResult {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  body: string;
  bodyTruncated: boolean;
  contentType: string;
  responseTimeMs: number;
  responseSize: number;
  assertions: AssertionResult[];
  extractedValues: ExtractedValue[];
}

export interface AssertionResult {
  assertionId: string;
  passed: boolean;
  message?: string;
  expected?: string;
  actual?: string;
}

export interface ExtractedValue {
  variableName: string;
  source: string;
  jsonPath: string;
  value: string;
}
