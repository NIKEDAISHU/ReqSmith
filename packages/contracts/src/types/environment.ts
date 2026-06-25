export type EnvironmentId = string & { __brand: "EnvironmentId" };

export type VariableScope = "global" | "project" | "environment" | "suite" | "extracted";
export type VariableType = "string" | "number" | "boolean" | "json" | "secret" | "dynamic" | "extracted";

export interface Variable {
  id: string;
  name: string;
  value: string;
  type: VariableType;
  scope: VariableScope;
  scopeId?: string;
  description?: string;
  enabled: boolean;
}

export interface Environment {
  id: EnvironmentId;
  projectId: string;
  name: string;
  baseUrl: string;
  variables: Variable[];
  authProfileId?: string;
  isDefault: boolean;
}
