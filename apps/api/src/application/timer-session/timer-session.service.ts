import type { TimerSessionRepository } from "../../domain/timer-session/timer-session.repository";
import type { TimerSession, CreateTimerSessionInput } from "../../domain/timer-session/timer-session.entity";

export class TimerSessionService {
  constructor(private timerSessionRepo: TimerSessionRepository) {}

  async getAll(from?: Date, to?: Date): Promise<TimerSession[]> {
    return this.timerSessionRepo.findAll(from, to);
  }

  async create(input: CreateTimerSessionInput): Promise<TimerSession> {
    return this.timerSessionRepo.create(input);
  }

  async getTodayStats(): Promise<{ totalSeconds: number; sessionCount: number }> {
    return this.timerSessionRepo.getTodayStats();
  }
}
