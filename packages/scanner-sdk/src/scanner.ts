import type { ScanContext, ScanEvent } from "@reqsmith/contracts";

export interface ScanSource {
  type: "directory" | "openapi_file" | "openapi_url";
  path?: string;
  url?: string;
}

export interface ApiScanner {
  readonly id: string;
  supports(source: ScanSource): boolean;
  scan(context: ScanContext, signal: AbortSignal): AsyncIterable<ScanEvent>;
}
