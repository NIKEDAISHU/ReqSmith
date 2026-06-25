import { create } from "zustand";
import type { EndpointSummary, EndpointDetail, EndpointQuery, Page } from "@reqsmith/contracts";
import type { GeneratedRequest, RequestResult } from "@reqsmith/contracts";
import { useProjectStore } from "./project-store.js";

interface LoginState {
  loggedIn: boolean;
  cookieHeader: string;
  username: string;
}

interface BatchTestResult {
  endpointId: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  responseTimeMs?: number;
}

interface BatchTestSummary {
  total: number;
  passed: number;
  failed: number;
}

interface EndpointState {
  endpoints: EndpointSummary[];
  selectedEndpoints: Set<string>;
  selectedEndpoint: EndpointDetail | null;
  generatedRequest: GeneratedRequest | null;
  sendResult: RequestResult | null;
  loading: boolean;
  sending: boolean;
  batchTesting: boolean;
  batchResults: BatchTestResult[];
  batchSummary: BatchTestSummary | null;
  searchQuery: string;
  selectedGroup: string | null;
  selectedMethod: string | null;
  sortByModifiedTime: boolean;
  baseUrl: string;
  login: LoginState;
  llmConfig: { apiUrl: string; model: string } | null;
  analyzing: boolean;
  toastMessage: string | null;
  editedOverrides: { params: Record<string, string>; headers: Record<string, string>; body: string };

  fetchEndpoints: (projectId: string) => Promise<void>;
  selectEndpoint: (summary: EndpointSummary) => Promise<void>;
  clearSelection: () => void;
  generateForEndpoint: (endpointId: string) => Promise<void>;
  sendRequest: (endpointId: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedGroup: (group: string | null) => void;
  setSelectedMethod: (method: string | null) => void;
  setBaseUrl: (url: string) => void;
  doLogin: (baseUrl: string, username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  toggleEndpointSelection: (endpointId: string) => Promise<void>;
  clearSelectedEndpoints: () => void;
  selectAllEndpoints: () => void;
  batchTestSelected: (projectId: string) => Promise<void>;
  setSortByModifiedTime: (sort: boolean) => Promise<void>;
  loadLLMConfig: () => Promise<void>;
  analyzeAndRename: (projectId: string) => Promise<void>;
  clearToast: () => void;
  setEditedParam: (key: string, value: string) => void;
  setEditedHeader: (key: string, value: string) => void;
  setEditedBody: (value: string) => void;
  resetOverrides: () => void;
}

export const useEndpointStore = create<EndpointState>((set, get) => ({
  endpoints: [],
  selectedEndpoints: new Set(),
  selectedEndpoint: null,
  generatedRequest: null,
  sendResult: null,
  loading: false,
  sending: false,
  batchTesting: false,
  batchResults: [],
  batchSummary: null,
  searchQuery: "",
  selectedGroup: null,
  selectedMethod: null,
  sortByModifiedTime: false,
  baseUrl: "http://localhost:8080",
  toastMessage: null,
  editedOverrides: { params: {}, headers: {}, body: "" },
  login: { loggedIn: false, cookieHeader: "", username: "" },
  llmConfig: null,
  analyzing: false,

  fetchEndpoints: async (projectId: string) => {
    set({ loading: true });
    try {
      const result: Page<EndpointSummary> = await window.reqsmith.endpoints.list({
        projectId,
        pageSize: 500,
      } as EndpointQuery);
      set({ endpoints: result.items, loading: false });
    } catch (err) {
      console.error("fetchEndpoints error:", err);
      set({ loading: false });
    }
  },

  selectEndpoint: async (summary: EndpointSummary) => {
    set({ selectedEndpoint: null, generatedRequest: null, sendResult: null, editedOverrides: { params: {}, headers: {}, body: "" } });
    try {
      const detail: EndpointDetail = await window.reqsmith.endpoints.get(summary.id);
      set({ selectedEndpoint: detail });
      get().generateForEndpoint(summary.id);
    } catch (err) {
      console.error("selectEndpoint error:", err);
    }
  },

  clearSelection: () => set({ selectedEndpoint: null, generatedRequest: null, sendResult: null, editedOverrides: { params: {}, headers: {}, body: "" } }),

  generateForEndpoint: async (endpointId: string) => {
    try {
      const result: GeneratedRequest = await window.reqsmith.endpoints.generateRequest({
        endpointId,
        environmentId: "default",
      });
      // Initialize edited overrides from generated values
      set({
        generatedRequest: result,
        editedOverrides: {
          params: { ...result.params },
          headers: { ...result.headers },
          body: result.body !== undefined ? JSON.stringify(result.body, null, 2) : "",
        },
      });
    } catch (err) {
      console.error("generateForEndpoint error:", err);
    }
  },

  sendRequest: async (endpointId: string) => {
    set({ sending: true, sendResult: null });
    const { editedOverrides, generatedRequest } = get();
    try {
      // Build overrides from edited values that differ from generated
      const overrides: Record<string, unknown> = {};
      if (generatedRequest) {
        const paramOverrides: Record<string, string> = {};
        for (const [k, v] of Object.entries(editedOverrides.params)) {
          if (v !== generatedRequest.params[k]) paramOverrides[k] = v;
        }
        if (Object.keys(paramOverrides).length > 0) overrides.params = paramOverrides;

        const headerOverrides: Record<string, string> = {};
        for (const [k, v] of Object.entries(editedOverrides.headers)) {
          if (v !== generatedRequest.headers[k]) headerOverrides[k] = v;
        }
        if (Object.keys(headerOverrides).length > 0) overrides.headers = headerOverrides;

        if (editedOverrides.body && editedOverrides.body !== JSON.stringify(generatedRequest.body, null, 2)) {
          try { overrides.body = JSON.parse(editedOverrides.body); } catch { overrides.body = editedOverrides.body; }
        }
      }
      const result: RequestResult = await window.reqsmith.endpoints.send({
        endpointId,
        environmentId: "default",
        overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      });
      set({ sendResult: result, sending: false });
    } catch (err) {
      console.error("sendRequest error:", err);
      set({ sending: false });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedGroup: (group) => set({ selectedGroup: group }),
  setSelectedMethod: (method) => set({ selectedMethod: method }),
  setBaseUrl: (url) => set({ baseUrl: url }),

  doLogin: async (baseUrl: string, username: string, password: string, rememberMe?: boolean) => {
    try {
      const result = await window.reqsmithDesktop.login({ baseUrl, username, password, rememberMe });
      if (result.success) {
        set({
          login: {
            loggedIn: true,
            cookieHeader: result.cookieHeader ?? "",
            username,
          },
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error("doLogin error:", err);
      return false;
    }
  },

  logout: () => set({
    login: { loggedIn: false, cookieHeader: "", username: "" },
  }),

  toggleEndpointSelection: async (endpointId: string) => {
    const selected = new Set(get().selectedEndpoints);
    if (selected.has(endpointId)) {
      selected.delete(endpointId);
    } else {
      selected.add(endpointId);
    }
    set({ selectedEndpoints: selected });
    await window.reqsmith.endpoints.toggleSelect({ endpointId, selected: selected.has(endpointId) });
  },

  clearSelectedEndpoints: () => {
    set({ selectedEndpoints: new Set(), batchResults: [], batchSummary: null });
  },

  selectAllEndpoints: () => {
    const allIds = new Set(get().endpoints.map((ep) => ep.id));
    set({ selectedEndpoints: allIds });
  },

  batchTestSelected: async (_projectId: string) => {
    const { selectedEndpoints } = get();
    if (selectedEndpoints.size === 0) return;

    set({ batchTesting: true, batchResults: [], batchSummary: null });
    try {
      const endpointIds = Array.from(selectedEndpoints);
      const result = await window.reqsmith.endpoints.batchTest({ endpointIds });
      if (result.success) {
        set({
          batchResults: result.results,
          batchSummary: result.summary,
          batchTesting: false,
        });
      } else {
        set({ batchTesting: false });
      }
    } catch (err) {
      console.error("batchTestSelected error:", err);
      set({ batchTesting: false });
    }
  },

  setSortByModifiedTime: async (sort: boolean) => {
    set({ sortByModifiedTime: sort });
    const { currentProject } = useProjectStore.getState();
    if (currentProject && sort) {
      const result = await window.reqsmith.endpoints.listByModifiedTime(currentProject.id);
      const mapped = result.map((ep): EndpointSummary => ({
        id: ep.id as EndpointSummary["id"],
        method: ep.method as EndpointSummary["method"],
        path: ep.path,
        name: ep.name,
        group: ep.group,
        tags: ep.tags,
        authRequired: false,
      }));
      set({ endpoints: mapped });
    }
  },

  loadLLMConfig: async () => {
    try {
      const result = await window.reqsmithDesktop.llmTestConnection({ apiUrl: "http://192.168.80.119:8080/v1", model: "DeepSeek-V4-Flash" });
      if (result?.success) {
        set({ llmConfig: { apiUrl: "http://192.168.80.119:8080/v1", model: "DeepSeek-V4-Flash" } });
      }
    } catch (err) {
      console.error("loadLLMConfig error:", err);
    }
  },
  analyzeAndRename: async (projectId: string) => {
    const { endpoints } = get();
    if (endpoints.length === 0) {
      set({ toastMessage: "暂无接口可分析" });
      return;
    }
    set({ analyzing: true, toastMessage: null });
    try {
      const endpointData = endpoints.map((ep) => ({
        id: String(ep.id),
        method: ep.method,
        path: ep.path,
        name: ep.name,
        group: ep.group,
        parameters: [],
      }));
      const result = await window.reqsmithDesktop.llmAnalyzeEndpoints({ projectId, endpoints: endpointData });
      if (result.success && result.results && result.results.length > 0) {
        await window.reqsmith.endpoints.batchRename({ renames: result.results });
        const updated = new Map(result.results.map((r) => [r.id, r]));
        const newEndpoints = endpoints.map((ep) => {
          const rename = updated.get(String(ep.id));
          if (!rename) return ep;
          return { ...ep, name: rename.name, group: rename.group };
        });
        set({ endpoints: newEndpoints, analyzing: false, toastMessage: `✅ 已为 ${result.results.length} 个接口生成中文名称和分类` });
      } else {
        set({ analyzing: false, toastMessage: `❌ AI 分析失败: ${result.error || "模型未返回有效结果"}` });
      }
    } catch (err) {
      console.error("analyzeAndRename error:", err);
      set({ analyzing: false, toastMessage: `❌ AI 分析异常: ${String(err)}` });
    }
  },
  clearToast: () => set({ toastMessage: null }),
  setEditedParam: (key, value) => set((s) => ({
    editedOverrides: { ...s.editedOverrides, params: { ...s.editedOverrides.params, [key]: value } },
  })),
  setEditedHeader: (key, value) => set((s) => ({
    editedOverrides: { ...s.editedOverrides, headers: { ...s.editedOverrides.headers, [key]: value } },
  })),
  setEditedBody: (value) => set((s) => ({
    editedOverrides: { ...s.editedOverrides, body: value },
  })),
  resetOverrides: () => {
    const gr = get().generatedRequest;
    if (gr) {
      set({
        editedOverrides: {
          params: { ...gr.params },
          headers: { ...gr.headers },
          body: gr.body !== undefined ? JSON.stringify(gr.body, null, 2) : "",
        },
      });
    }
  },
}));