import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { ProjectService } from "@reqsmith/domain";
import { CreateProjectInputSchema, UpdateProjectInputSchema, ProjectIdSchema } from "@reqsmith/contracts";

export function registerProjectIpc(service: ProjectService): void {
  ipcMain.handle("projects:list", async () => {
    return service.listProjects();
  });

  ipcMain.handle("projects:create", async (_event: IpcMainInvokeEvent, raw: unknown) => {
    const input = CreateProjectInputSchema.parse(raw);
    return service.createProject(input);
  });

  ipcMain.handle("projects:get", async (_event: IpcMainInvokeEvent, raw: unknown) => {
    const projectId = ProjectIdSchema.parse(raw);
    return service.getProject(projectId);
  });

  ipcMain.handle("projects:update", async (_event: IpcMainInvokeEvent, raw: unknown) => {
    const input = UpdateProjectInputSchema.parse(raw);
    return service.updateProject(input);
  });

  ipcMain.handle("projects:remove", async (_event: IpcMainInvokeEvent, raw: unknown) => {
    const projectId = ProjectIdSchema.parse(raw);
    await service.removeProject(projectId);
  });
}
