import { z } from "zod"; import { ProjectIdSchema } from "./project.js";

export type EndpointId = z.infer<typeof EndpointIdSchema>;
export const EndpointIdSchema = z.string().brand("EndpointId");

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type ParameterLocation = "path" | "query" | "header" | "cookie" | "body" | "part";

export interface EndpointParameter {
  name: string;
  location: ParameterLocation;
  required: boolean;
  type: string;
  description?: string;
  defaultValue?: string;
  example?: string;
  constraints?: ParameterConstraint[];
}

export interface ParameterConstraint {
  kind: string;
  value?: string | number;
  message?: string;
}

export interface RequestBodySchema {
  contentType: string;
  schemaRef?: string;
  required: boolean;
  description?: string;
}

export interface ResponseSpec {
  statusCode: string;
  description?: string;
  schemaRef?: string;
}

export interface AuthRequirement {
  type: string;
  name: string;
  required: boolean;
}

export interface SourceLocation {
  filePath: string;
  relativePath: string;
  startLine: number;
  endLine: number;
  className: string;
  methodName: string;
  fingerprint: string;
  fileModifiedAt?: number;
  methodLine?: number;
  classLine?: number;
}

export interface NormalizedEndpoint {
  id: EndpointId;
  projectId: string;
  method: HttpMethod;
  path: string;
  name: string;
  group: string;
  tags: string[];
  parameters: EndpointParameter[];
  requestBody?: RequestBodySchema;
  responses: ResponseSpec[];
  auth: AuthRequirement[];
  source?: SourceLocation;
  fingerprint: string;
}

export interface EndpointSummary {
  id: EndpointId;
  method: HttpMethod;
  path: string;
  name: string;
  group: string;
  tags: string[];
  authRequired: boolean;
  lastTestStatus?: "success" | "failure" | "warning";
  lastTestAt?: string;
}

export interface EndpointDetail extends NormalizedEndpoint {
  overrides: Record<string, unknown>;
  scanRunId?: string;
}

export const EndpointQuerySchema = z.object({
  projectId: ProjectIdSchema,
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).optional(),
  group: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export type EndpointQuery = z.infer<typeof EndpointQuerySchema>;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
