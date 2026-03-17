import type { TaskRepository } from "../../domain/task/task.repository";
import type { Task, TaskSource } from "../../domain/task/task.entity";

export class TaskService {
  constructor(private repo: TaskRepository) {}

  async getAll(): Promise<Task[]> {
    return this.repo.findAll();
  }

  async getBySource(source: TaskSource): Promise<Task[]> {
    return this.repo.findBySource(source);
  }

  async getUnscheduled(): Promise<Task[]> {
    return this.repo.findUnscheduled();
  }

  async getById(id: string): Promise<Task | null> {
    return this.repo.findById(id);
  }

  async getByExternalId(externalId: string, source: TaskSource): Promise<Task | null> {
    return this.repo.findByExternalId(externalId, source);
  }
}
