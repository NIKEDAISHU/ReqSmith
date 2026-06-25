import { contextBridge, ipcRenderer } from "electron";
import type { ReqSmithIpc } from "@reqsmith/contracts";

const api: ReqSmithIpc = {
  projects: {
    list: () => ipcRenderer.invoke("projects:list"),
    create: (input) => ipcRenderer.invoke("projects:create", input),
    get: (projectId) => ipcRenderer.invoke("projects:get", projectId),
    update: (input) => ipcRenderer.invoke("projects:update", input),
    remove: (projectId) => ipcRenderer.invoke("projects:remove", projectId),
    scan: (input) => ipcRenderer.invoke("projects:scan", input),
    listScanRuns: (projectId) => ipcRenderer.invoke("projects:listScanRuns", projectId),
  },
  endpoints: {
    list: (query) => ipcRenderer.invoke("endpoints:list", query),
    get: (endpointId) => ipcRenderer.invoke("endpoints:get", endpointId),
    saveOverride: (input) => ipcRenderer.invoke("endpoints:saveOverride", input),
    openSource: (location) => ipcRenderer.invoke("endpoints:openSource", location),
    generateRequest: (input) => ipcRenderer.invoke("endpoints:generateRequest", input),
    send: (input) => ipcRenderer.invoke("endpoints:send", input),
    toggleSelect: (input) => ipcRenderer.invoke("endpoints:toggleSelect", input),
    getSelected: (projectId) => ipcRenderer.invoke("endpoints:getSelected", projectId),
    listByModifiedTime: (projectId) => ipcRenderer.invoke("endpoints:listByModifiedTime", projectId),
    batchTest: (input) => ipcRenderer.invoke("endpoints:batchTest", input),
  },
  suites: {
    list: (projectId) => ipcRenderer.invoke("suites:list", projectId),
    create: (input) => ipcRenderer.invoke("suites:create", input),
    get: (suiteId) => ipcRenderer.invoke("suites:get", suiteId),
    update: (input) => ipcRenderer.invoke("suites:update", input),
    remove: (suiteId) => ipcRenderer.invoke("suites:remove", suiteId),
    plan: (input) => ipcRenderer.invoke("suites:plan", input),
  },
  runs: {
    start: (input) => ipcRenderer.invoke("runs:start", input),
    get: (runId) => ipcRenderer.invoke("runs:get", runId),
    cancel: (runId) => ipcRenderer.invoke("runs:cancel", runId),
    retryFailed: (runId) => ipcRenderer.invoke("runs:retryFailed", runId),
  },
};

// Also expose the directory picker
export interface DesktopExtras {
  openDirectoryDialog: () => Promise<string | null>;
  login: (input: { baseUrl: string; username: string; password: string; rememberMe?: boolean }) => Promise<{
    success: boolean;
    cookies?: Record<string, string>;
    cookieHeader?: string;
    error?: string;
  }>;
  llmGenerateValues: (input: { config: { apiUrl: string; model: string; apiKey?: string }; context: Record<string, unknown>; parameters: unknown[] }) => Promise<{ success: boolean; values?: Record<string, string>; error?: string }>;
  llmTestConnection: (config: { apiUrl: string; model: string; apiKey?: string }) => Promise<{ success: boolean; error?: string }>;
  llmGetConfig: () => Promise<{ apiUrl: string; model: string; apiKey?: string } | null>;
  llmSetConfig: (config: { apiUrl: string; model: string; apiKey?: string }) => Promise<{ success: boolean }>;
}

const extras: DesktopExtras = {
  openDirectoryDialog: () => ipcRenderer.invoke("dialog:openDirectory"),
  login: (input) => ipcRenderer.invoke("auth:login", input),
  llmGenerateValues: (input) => ipcRenderer.invoke("llm:generateValues", input),
  llmTestConnection: (config) => ipcRenderer.invoke("llm:testConnection", config),
  llmGetConfig: () => ipcRenderer.invoke("llm:getConfig"),
  llmSetConfig: (config) => ipcRenderer.invoke("llm:setConfig", config),
};

contextBridge.exposeInMainWorld("reqsmith", api);
contextBridge.exposeInMainWorld("reqsmithDesktop", extras);
