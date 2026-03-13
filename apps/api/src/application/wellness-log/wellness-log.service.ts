import type { WellnessLogRepository } from "../../domain/wellness-log/wellness-log.repository";
import type { WellnessLog } from "../../domain/wellness-log/wellness-log.entity";

const DEFAULT_GOALS: Record<string, number> = {
  water: 2000,
  fruits_veggies: 5,
};

export class WellnessLogService {
  constructor(private wellnessLogRepo: WellnessLogRepository) {}

  async getByDate(date: string): Promise<WellnessLog[]> {
    return this.wellnessLogRepo.findByDate(date);
  }

  async getByDateAndType(date: string, type: string): Promise<WellnessLog | null> {
    return this.wellnessLogRepo.findByDateAndType(date, type);
  }

  async getByRange(from: string, to: string, type?: string): Promise<WellnessLog[]> {
    return this.wellnessLogRepo.findByRange(from, to, type);
  }

  async increment(date: string, type: string, amount: number): Promise<WellnessLog> {
    const existing = await this.wellnessLogRepo.findByDateAndType(date, type);

    if (existing) {
      const newValue = Math.max(0, existing.value + amount);
      const result = await this.wellnessLogRepo.increment(date, type, amount);
      return result ?? existing;
    }

    const goal = DEFAULT_GOALS[type] ?? 1;
    return this.wellnessLogRepo.upsert({
      type,
      date,
      value: Math.max(0, amount),
      goal,
    });
  }

  async setGoal(date: string, type: string, goal: number): Promise<WellnessLog> {
    const existing = await this.wellnessLogRepo.findByDateAndType(date, type);

    if (existing) {
      return this.wellnessLogRepo.upsert({
        type,
        date,
        value: existing.value,
        goal,
      });
    }

    return this.wellnessLogRepo.upsert({
      type,
      date,
      value: 0,
      goal,
    });
  }
}
