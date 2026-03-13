import type { TimerSession, CreateTimerSessionInput } from "./timer-session.entity";

export interface TimerSessionRepository {
  findAll(from?: Date, to?: Date): Promise<TimerSession[]>;
  findById(id: string): Promise<TimerSession | null>;
  create(input: CreateTimerSessionInput): Promise<TimerSession>;
  getTodayStats(): Promise<{ totalSeconds: number; sessionCount: number }>;
}
