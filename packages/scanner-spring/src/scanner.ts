import type { ApiScanner, ScanSource } from "@reqsmith/scanner-sdk";
import type { ScanContext, ScanEvent, NormalizedEndpoint, EndpointParameter, ParameterConstraint } from "@reqsmith/contracts";
import { scanSpringProject } from "./java-parser.js";
import type { DiscoveredEndpoint, ScanResult } from "./java-parser.js";

export class SpringScanner implements ApiScanner {
  readonly id = "spring-boot";

  supports(source: ScanSource): boolean {
    return source.type === "directory";
  }

  async *scan(context: ScanContext, signal: AbortSignal): AsyncIterable<ScanEvent> {
    yield { type: "scan.started", timestamp: new Date().toISOString(), data: { projectId: context.projectId } };

    let result: ScanResult;
    try {
      result = await scanSpringProject(
        context.source.path ?? "",
        context.projectId,
        signal,
        (_msg) => {},
      );
    } catch (err) {
      yield {
        type: "scan.error",
        timestamp: new Date().toISOString(),
        data: { projectId: context.projectId, error: String(err) },
      };
      yield {
        type: "scan.completed",
        timestamp: new Date().toISOString(),
        data: { projectId: context.projectId, endpointsFound: 0 },
      };
      return;
    }

    // Emit each discovered endpoint as a ScanEvent
    for (const ep of result.endpoints) {
      const normalized = toNormalizedEndpoint(ep, context.projectId, result.config.contextPath);
      yield {
        type: "scan.endpoint_found",
        timestamp: new Date().toISOString(),
        data: { endpoint: normalized } as Record<string, unknown>,
      };
    }

    yield {
      type: "scan.completed",
      timestamp: new Date().toISOString(),
      data: {
        projectId: context.projectId,
        endpointsFound: result.endpoints.length,
        contextPath: result.config.contextPath,
        port: result.config.port,
      },
    };
  }
}

function toNormalizedEndpoint(ep: DiscoveredEndpoint, projectId: string, _contextPath: string): NormalizedEndpoint {
  // Keep path pure (no context-path prefix) — baseUrl includes context-path
  const path = ep.path;
  return {
    id: ep.fingerprint as NormalizedEndpoint["id"],
    projectId,
    method: ep.method as NormalizedEndpoint["method"],
    path,
    name: ep.name,
    group: ep.group,
    tags: [],
    parameters: ep.parameters.map(toEndpointParameter),
    requestBody: ep.requestBodyType
      ? { contentType: "application/json", required: true, schemaRef: ep.requestBodyType }
      : undefined,
    responses: ep.returnTypeName
      ? [{ statusCode: "200", schemaRef: ep.returnTypeName }]
      : [],
    auth: ep.requiresAuth
      ? [{ type: "cookie", name: "JSESSIONID", required: true }]
      : [],
    source: {
      filePath: ep.source.filePath,
      relativePath: ep.source.relativePath,
      startLine: ep.source.startLine,
      endLine: ep.source.endLine,
      className: ep.source.className,
      methodName: ep.source.methodName,
      fingerprint: ep.fingerprint,
      fileModifiedAt: ep.sourceFileModifiedAt,
      methodLine: ep.sourceMethodLine,
      classLine: ep.sourceClassLine,
    },
    fingerprint: ep.fingerprint,
  };
}
function toEndpointParameter(p: { name: string; location: string; required: boolean; type: string }): EndpointParameter {
  return {
    name: p.name,
    location: p.location as EndpointParameter["location"],
    required: p.required,
    type: p.type,
    constraints: [] as ParameterConstraint[],
  };
}
