import type { TaskTriage, SetTriageInput, TriageStatus } from "./triage.entity";

export interface TriageRepository {
  findAll(): Promise<TaskTriage[]>;
  findByStatus(status: TriageStatus): Promise<TaskTriage[]>;
  findByClickupTaskId(clickupTaskId: string): Promise<TaskTriage | null>;
  upsert(input: SetTriageInput): Promise<TaskTriage>;
  bulkUpsert(inputs: SetTriageInput[]): Promise<void>;
  deleteByClickupTaskId(clickupTaskId: string): Promise<void>;
  deleteAll(): Promise<void>;
}
