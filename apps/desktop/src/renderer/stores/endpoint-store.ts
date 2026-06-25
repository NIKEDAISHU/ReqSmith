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
  login: { loggedIn: false, cookieHeader: "", username: "" },
  llmConfig: null,

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
    set({ selectedEndpoint: null, generatedRequest: null, sendResult: null });
    try {
      const detail: EndpointDetail = await window.reqsmith.endpoints.get(summary.id);
      set({ selectedEndpoint: detail });
      get().generateForEndpoint(summary.id);
    } catch (err) {
      console.error("selectEndpoint error:", err);
    }
  },

  clearSelection: () => set({ selectedEndpoint: null, generatedRequest: null, sendResult: null }),

  generateForEndpoint: async (endpointId: string) => {
    try {
      const result: GeneratedRequest = await window.reqsmith.endpoints.generateRequest({
        endpointId,
        environmentId: "default",
      });
      set({ generatedRequest: result });
    } catch (err) {
      console.error("generateForEndpoint error:", err);
    }
  },

  sendRequest: async (endpointId: string) => {
    set({ sending: true, sendResult: null });
    try {
      const result: RequestResult = await window.reqsmith.endpoints.send({
        endpointId,
        environmentId: "default",
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
}));