import type { TaskRepository } from "../../domain/task/task.repository";
import type { Task, TaskSource, CreateTaskInput, UpdateTaskInput } from "../../domain/task/task.entity";

export class TaskService {
  constructor(private repo: TaskRepository) {}

  async getAll(options?: { source?: string; limit?: number; offset?: number }): Promise<Task[]> {
    return this.repo.findAll(options);
  }

  async count(source?: string): Promise<number> {
    return this.repo.countAll(source);
  }

  async create(input: CreateTaskInput): Promise<Task> {
    return this.repo.create(input);
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    return this.repo.update(id, input);
  }

  async getBySource(source: TaskSource): Promise<Task[]> {
    return this.repo.findBySource(source);
  }

  async getUnscheduled(options?: { limit?: number; offset?: number }): Promise<Task[]> {
    return this.repo.findUnscheduled(options);
  }

  async countUnscheduled(): Promise<number> {
    return this.repo.countUnscheduled();
  }

  async getById(id: string): Promise<Task | null> {
    return this.repo.findById(id);
  }

  async getByExternalId(externalId: string, source: TaskSource): Promise<Task | null> {
    return this.repo.findByExternalId(externalId, source);
  }
}
