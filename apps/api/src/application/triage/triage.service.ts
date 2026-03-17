import type { TriageRepository } from "../../domain/triage/triage.repository";
import type { TaskTriage, SetTriageInput, TriageStatus } from "../../domain/triage/triage.entity";

export class TriageService {
  constructor(private repo: TriageRepository) {}

  async getAll(): Promise<TaskTriage[]> {
    return this.repo.findAll();
  }

  async getByStatus(status: TriageStatus): Promise<TaskTriage[]> {
    return this.repo.findByStatus(status);
  }

  async setTriage(input: SetTriageInput): Promise<TaskTriage> {
    return this.repo.upsert(input);
  }

  async bulkSetTriage(inputs: SetTriageInput[]): Promise<void> {
    return this.repo.bulkUpsert(inputs);
  }

  async resetTriage(taskId: string): Promise<void> {
    return this.repo.deleteByTaskId(taskId);
  }

  async resetAll(): Promise<void> {
    return this.repo.deleteAll();
  }
}
