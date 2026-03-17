import type { ProjectRepository } from "../../domain/project/project.repository";
import type { Project, CreateProjectInput, UpdateProjectInput } from "../../domain/project/project.entity";

export class ProjectService {
  constructor(private projectRepo: ProjectRepository) {}

  async getAll(): Promise<Project[]> {
    return this.projectRepo.findAll();
  }

  async getById(id: string): Promise<Project | null> {
    return this.projectRepo.findById(id);
  }

  async create(input: CreateProjectInput): Promise<Project> {
    return this.projectRepo.create(input);
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
    return this.projectRepo.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.projectRepo.delete(id);
  }
}
