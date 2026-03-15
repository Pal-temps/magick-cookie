import type { DogWalk, CreateDogWalkInput, StopDogWalkInput } from "./dog-walk.entity";

export interface DogWalkRepository {
  findActive(): Promise<DogWalk | null>;
  findAll(from?: Date, to?: Date): Promise<DogWalk[]>;
  create(input: CreateDogWalkInput): Promise<DogWalk>;
  stop(id: string, input: StopDogWalkInput): Promise<DogWalk>;
  getTodayStats(): Promise<{ totalSeconds: number; walkCount: number }>;
  getDailyStats(from: Date, to: Date): Promise<{ date: string; totalSeconds: number; walkCount: number }[]>;
}
