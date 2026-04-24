import type { Task, TaskSource, CreateTaskInput, UpdateTaskInput } from "./task.entity";

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface TaskRepository {
  findAll(options?: { source?: string; limit?: number; offset?: number }): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
  findByExternalId(externalId: string, source: TaskSource): Promise<Task | null>;
  findBySource(source: TaskSource): Promise<Task[]>;
  findUnscheduled(options?: PaginationOptions): Promise<Task[]>;
  countAll(source?: string): Promise<number>;
  countUnscheduled(): Promise<number>;
  upsertByExternalId(input: CreateTaskInput): Promise<Task>;
  create(input: CreateTaskInput): Promise<Task>;
  update(id: string, input: UpdateTaskInput): Promise<Task | null>;
  deleteBySource(source: TaskSource): Promise<void>;
  deleteNotInExternalIds(source: TaskSource, externalIds: string[]): Promise<void>;
  delete(id: string): Promise<boolean>;
}
