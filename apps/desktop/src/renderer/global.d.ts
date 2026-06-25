import type { ReqSmithIpc } from "@reqsmith/contracts";

declare global {
  interface Window {
    reqsmith: ReqSmithIpc;
    reqsmithDesktop: {
      openDirectoryDialog: () => Promise<string | null>;
      login: (input: { baseUrl: string; username: string; password: string; rememberMe?: boolean }) => Promise<{
        success: boolean;
        cookies?: Record<string, string>;
        cookieHeader?: string;
        error?: string;
      }>;
      llmGenerateValues: (input: {
        config: { apiUrl: string; model: string; apiKey?: string };
        context: { method: string; path: string; name: string; group: string; tags: string[]; parameters: Array<{ name: string; type: string; location: string; required: boolean }> };
        parameters: Array<{ name: string; type: string; location: string; required: boolean }>;
      }) => Promise<{
        success: boolean;
        values?: Record<string, string>;
        error?: string;
      }>;
      llmTestConnection: (config: { apiUrl: string; model: string; apiKey?: string }) => Promise<{
        success: boolean;
        error?: string;
      }>;
      llmGetConfig: () => Promise<{ apiUrl: string; model: string; apiKey?: string } | null>;
      llmSetConfig: (config: { apiUrl: string; model: string; apiKey?: string }) => Promise<{ success: boolean }>;
      updateCheck: () => Promise<{ available: boolean; info: { version: string } | null; error?: string }>;
      updateDownload: () => Promise<{ success: boolean; error?: string }>;
      updateInstall: () => Promise<{ success: boolean }>;
      onUpdateAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes: string }) => void) => () => void;
      onUpdateProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => () => void;
      onUpdateDownloaded: (callback: () => void) => () => void;
    };
  }
}
