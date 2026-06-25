import type { Project, ProjectSummary, CreateProjectInput, UpdateProjectInput, ProjectId } from "@reqsmith/contracts";

export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  get(id: ProjectId): Promise<Project | null>;
  create(input: CreateProjectInput): Promise<Project>;
  update(input: UpdateProjectInput): Promise<Project>;
  remove(id: ProjectId): Promise<void>;
  getEndpointCount(id: ProjectId): Promise<number>;
}

export class ProjectService {
  constructor(private repo: ProjectRepository) {}

  async listProjects(): Promise<ProjectSummary[]> {
    return this.repo.list();
  }

  async getProject(id: ProjectId): Promise<Project> {
    const project = await this.repo.get(id);
    if (!project) throw new Error(`Project not found: ${id}`);
    return project;
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    return this.repo.create(input);
  }

  async updateProject(input: UpdateProjectInput): Promise<Project> {
    return this.repo.update(input);
  }

  async removeProject(id: ProjectId): Promise<void> {
    await this.repo.remove(id);
  }
}
