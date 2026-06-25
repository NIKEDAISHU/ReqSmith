import { z } from "zod";

export type ProjectId = z.infer<typeof ProjectIdSchema>;
export const ProjectIdSchema = z.string().brand("ProjectId");

export type SourceType =
  | "SOURCE_DIRECTORY"
  | "OPENAPI_FILE"
  | "OPENAPI_URL"
  | "MANUAL"
  | "MIXED";

export const CreateProjectInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sourceType: z.enum(["SOURCE_DIRECTORY", "OPENAPI_FILE", "OPENAPI_URL", "MANUAL", "MIXED"]),
  sourcePath: z.string().optional(),
  sourceUrl: z.string().url().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const UpdateProjectInputSchema = z.object({
  projectId: ProjectIdSchema,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

export interface Project {
  id: ProjectId;
  name: string;
  description?: string;
  sourceType: SourceType;
  sourcePath?: string;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastScanAt?: string;
  baseUrl?: string;
}

export interface ProjectSummary {
  id: ProjectId;
  name: string;
  sourceType: SourceType;
  endpointCount: number;
  lastScanAt?: string;
  updatedAt: string;
}
