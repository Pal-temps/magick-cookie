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

  async resetTriage(clickupTaskId: string): Promise<void> {
    return this.repo.deleteByClickupTaskId(clickupTaskId);
  }

  async resetAll(): Promise<void> {
    return this.repo.deleteAll();
  }
}
