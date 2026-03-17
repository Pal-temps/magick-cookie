import type { TaskTriage, SetTriageInput, TriageStatus } from "./triage.entity";

export interface TriageRepository {
  findAll(): Promise<TaskTriage[]>;
  findByStatus(status: TriageStatus): Promise<TaskTriage[]>;
  findByTaskId(taskId: string): Promise<TaskTriage | null>;
  upsert(input: SetTriageInput): Promise<TaskTriage>;
  bulkUpsert(inputs: SetTriageInput[]): Promise<void>;
  deleteByTaskId(taskId: string): Promise<void>;
  deleteAll(): Promise<void>;
  countByStatus(): Promise<Record<string, number>>;
  countByDateRange(from: Date, to: Date): Promise<number>;
}
