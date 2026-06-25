import type { ApiScanner, ScanSource } from "@reqsmith/scanner-sdk";
import type { ScanContext, ScanEvent } from "@reqsmith/contracts";

export class OpenApiScanner implements ApiScanner {
  readonly id = "openapi-3";

  supports(source: ScanSource): boolean {
    return source.type === "openapi_file" || source.type === "openapi_url";
  }

  async *scan(context: ScanContext, _signal: AbortSignal): AsyncIterable<ScanEvent> {
    yield { type: "scan.started", timestamp: new Date().toISOString(), data: { projectId: context.projectId } };

    // TODO: implement OpenAPI parsing in Phase 1
    yield {
      type: "scan.completed",
      timestamp: new Date().toISOString(),
      data: { projectId: context.projectId, endpointsFound: 0 },
    };
  }
}
