import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initDatabase } from "@reqsmith/persistence";
import { ProjectRepositoryImpl } from "@reqsmith/persistence";
import { ProjectService } from "@reqsmith/domain";
import { registerProjectIpc } from "./ipc/project.js";
import { registerScanIpc } from "./ipc/scan.js";
import { registerEndpointIpc } from "./ipc/endpoints.js";
import { registerAuthIpc } from "./ipc/auth.js";
import { registerLLMIpc } from "./ipc/llm.js";
import { initAutoUpdater } from "./updater.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "ReqSmith",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "bottom" });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function initServices() {
  const userDataPath = app.getPath("userData");
  const dbPath = path.join(userDataPath, "reqsmith.db");
  const db = await initDatabase(dbPath);
  const repo = new ProjectRepositoryImpl(db);
  const projectService = new ProjectService(repo);
  registerProjectIpc(projectService);
  registerScanIpc(projectService, db);
  registerEndpointIpc(db);
  registerAuthIpc();
  registerLLMIpc();
}

app.whenReady().then(async () => {
  await initServices();
  await createWindow();
  if (mainWindow) initAutoUpdater(mainWindow);


  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("dialog:openDirectory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (result.canceled) return null;
  return result.filePaths[0] ?? null;
});
