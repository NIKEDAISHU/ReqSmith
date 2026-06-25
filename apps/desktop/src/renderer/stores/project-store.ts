import { create } from "zustand";
import type { Project, ProjectSummary, CreateProjectInput } from "@reqsmith/contracts";

interface ScanResult {
  endpointsFound: number;
  warnings: number;
  errors: number;
}

interface ProjectState {
  projects: ProjectSummary[];
  currentProject: Project | null;
  scanning: boolean;
  loading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  selectProject: (id: string) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  scanProject: (projectId: string) => Promise<ScanResult>;
  removeProject: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  scanning: false,
  loading: false,
  error: null,
  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await window.reqsmith.projects.list();
      set({ projects, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  selectProject: async (id: string) => {
    try {
      const project = await window.reqsmith.projects.get(id);
      set({ currentProject: project });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  createProject: async (input: CreateProjectInput) => {
    const project = await window.reqsmith.projects.create(input);
    await get().fetchProjects();
    return project;
  },

  scanProject: async (projectId: string) => {
    set({ scanning: true, error: null });
    try {
      const result = await window.reqsmith.projects.scan({ projectId, full: true });
      const scanResult = result as unknown as ScanResult & { baseUrl?: string; contextPath?: string; port?: number };
      set({ scanning: false });
      await get().fetchProjects();
      // Refresh currentProject to pick up the new baseUrl from DB
      if (get().currentProject?.id === projectId) {
        await get().selectProject(projectId);
      }
      return scanResult;
    } catch (err) {
      set({ error: String(err), scanning: false });
      return { endpointsFound: 0, warnings: 0, errors: 1 };
    }
  },

  removeProject: async (id: string) => {
    await window.reqsmith.projects.remove(id);
    if (get().currentProject?.id === id) {
      set({ currentProject: null });
    }
    await get().fetchProjects();
  },

  clearError: () => set({ error: null }),
}));
