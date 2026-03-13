import type { WellnessLog, UpsertWellnessLogInput } from "./wellness-log.entity";

export interface WellnessLogRepository {
  findByDateAndType(date: string, type: string): Promise<WellnessLog | null>;
  findByDate(date: string): Promise<WellnessLog[]>;
  findByRange(from: string, to: string, type?: string): Promise<WellnessLog[]>;
  upsert(input: UpsertWellnessLogInput): Promise<WellnessLog>;
  increment(date: string, type: string, amount: number): Promise<WellnessLog | null>;
}
