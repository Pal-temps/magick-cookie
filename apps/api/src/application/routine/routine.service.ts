import type { RoutineRepository } from "../../domain/routine/routine.repository";
import type { Routine, CreateRoutineInput, UpdateRoutineInput } from "../../domain/routine/routine.entity";

export class RoutineService {
  constructor(private routineRepo: RoutineRepository) {}

  async getAll(): Promise<Routine[]> {
    return this.routineRepo.findAll();
  }

  async getById(id: string): Promise<Routine | null> {
    return this.routineRepo.findById(id);
  }

  async getEnabled(): Promise<Routine[]> {
    return this.routineRepo.findEnabled();
  }

  async create(input: CreateRoutineInput): Promise<Routine> {
    return this.routineRepo.create(input);
  }

  async update(id: string, input: UpdateRoutineInput): Promise<Routine | null> {
    return this.routineRepo.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.routineRepo.delete(id);
  }

  async markRun(id: string): Promise<void> {
    await this.routineRepo.markRun(id);
  }
}
