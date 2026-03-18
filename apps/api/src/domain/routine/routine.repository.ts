import type { Routine, CreateRoutineInput, UpdateRoutineInput } from "./routine.entity";

export interface RoutineRepository {
  findAll(): Promise<Routine[]>;
  findById(id: string): Promise<Routine | null>;
  findEnabled(): Promise<Routine[]>;
  create(input: CreateRoutineInput): Promise<Routine>;
  update(id: string, input: UpdateRoutineInput): Promise<Routine | null>;
  delete(id: string): Promise<boolean>;
  markRun(id: string): Promise<void>;
}
