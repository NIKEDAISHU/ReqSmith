import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { ProjectService } from "@reqsmith/domain";
import type { Kysely } from "kysely";
import type { Database } from "@reqsmith/persistence";
import { EndpointRepository } from "@reqsmith/persistence";
import { SpringScanner } from "@reqsmith/scanner-spring";
import type { ScanContext, NormalizedEndpoint } from "@reqsmith/contracts";
import { ProjectIdSchema } from "@reqsmith/contracts";

export function registerScanIpc(service: ProjectService, db: Kysely<Database>): void {
  const scanner = new SpringScanner();
  const endpointRepo = new EndpointRepository(db);

  ipcMain.handle("projects:scan", async (_event: IpcMainInvokeEvent, raw: unknown) => {
    try {
      const rawInput = raw as Record<string, unknown>;
      const projectId = ProjectIdSchema.parse(rawInput.projectId);
      const project = await service.getProject(projectId);

      const context: ScanContext = {
        projectId,
        source: {
          type: "directory",
          path: project.sourcePath ?? "",
        },
      };

      const controller = new AbortController();
      const endpoints: NormalizedEndpoint[] = [];
      let warnings = 0;
      let errors = 0;
      let contextPath = "";
      let port = 8080;

      for await (const event of scanner.scan(context, controller.signal)) {
        if (event.type === "scan.endpoint_found") {
          const ep = event.data.endpoint as NormalizedEndpoint;
          if (ep) endpoints.push(ep);
        } else if (event.type === "scan.warning") {
          warnings++;
        } else if (event.type === "scan.error") {
          errors++;
        } else if (event.type === "scan.completed") {
          const data = event.data as Record<string, unknown>;
          if (data.contextPath && typeof data.contextPath === "string") {
            contextPath = data.contextPath;
          }
          if (data.port && typeof data.port === "number") {
            port = data.port;
          }
        }
      }

      // Persist endpoints
      const saved = await endpointRepo.replaceForProject(projectId, endpoints);

      // Build base URL from discovered config
      const baseUrl = `http://localhost:${port}${contextPath}`;
      console.log(`[scan] Project ${projectId}: found ${endpoints.length}, saved ${saved} endpoints, baseUrl=${baseUrl}`);

      // Save base_url to project row
      await db
        .updateTable("project")
        .set({ base_url: baseUrl, last_scan_at: new Date().toISOString() })
        .where("id", "=", projectId)
        .execute();

      return {
        taskId: `scan-${projectId}-${Date.now()}`,
        type: "scan",
        status: "completed",
        endpointsFound: saved,
        warnings,
        errors,
        baseUrl,
        contextPath,
        port,
      };
    } catch (err) {
      console.error("[scan] Error:", err);
      return {
        taskId: `scan-error-${Date.now()}`,
        type: "scan",
        status: "failed",
        endpointsFound: 0,
        warnings: 0,
        errors: 1,
        error: String(err),
      };
    }
  });
}
