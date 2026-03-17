import type { Task, TaskSource, CreateTaskInput } from "./task.entity";

export interface TaskRepository {
  findAll(): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
  findByExternalId(externalId: string, source: TaskSource): Promise<Task | null>;
  findBySource(source: TaskSource): Promise<Task[]>;
  findUnscheduled(): Promise<Task[]>;
  upsertByExternalId(input: CreateTaskInput): Promise<Task>;
  create(input: CreateTaskInput): Promise<Task>;
  deleteBySource(source: TaskSource): Promise<void>;
  deleteNotInExternalIds(source: TaskSource, externalIds: string[]): Promise<void>;
  delete(id: string): Promise<boolean>;
}
