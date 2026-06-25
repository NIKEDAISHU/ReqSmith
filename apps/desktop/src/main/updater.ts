import { autoUpdater, type UpdateInfo } from "electron-updater";
import { BrowserWindow, ipcMain } from "electron";

let updateAvailable = false;
let updateInfo: UpdateInfo | null = null;

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  // Don't check for updates in dev mode
  if (process.env.VITE_DEV_SERVER_URL) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    updateAvailable = true;
    updateInfo = info;
    mainWindow.webContents.send("update:available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : Array.isArray(info.releaseNotes) ? info.releaseNotes.map((n) => n.note).join("\n") : "",
    });
  });

  autoUpdater.on("update-not-available", () => {
    updateAvailable = false;
    updateInfo = null;
    mainWindow.webContents.send("update:not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow.webContents.send("update:progress", {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", () => {
    mainWindow.webContents.send("update:downloaded");
  });

  autoUpdater.on("error", (err) => {
    mainWindow.webContents.send("update:error", { message: err?.message ?? "Unknown error" });
  });

  // IPC handlers
  ipcMain.handle("update:check", async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { available: updateAvailable, info: updateInfo ? { version: updateInfo.version } : null };
    } catch (err) {
      return { available: false, error: String(err) };
    }
  });

  ipcMain.handle("update:download", async () => {
    if (!updateAvailable) return { success: false, error: "No update available" };
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("update:install", () => {
    setImmediate(() => autoUpdater.quitAndInstall());
    return { success: true };
  });

  // Check on startup (delayed 3s to avoid blocking launch)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);
}
