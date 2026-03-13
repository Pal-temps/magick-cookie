import type { TimerSession, CreateTimerSessionInput } from "./timer-session.entity";

export interface DailyTimerStats {
  date: string;
  totalSeconds: number;
  focusSeconds: number;
  sessionCount: number;
  completedCount: number;
  cancelledCount: number;
}

export interface TimerSessionRepository {
  findAll(from?: Date, to?: Date): Promise<TimerSession[]>;
  findById(id: string): Promise<TimerSession | null>;
  create(input: CreateTimerSessionInput): Promise<TimerSession>;
  getTodayStats(): Promise<{ totalSeconds: number; sessionCount: number }>;
  getDailyStats(from: Date, to: Date): Promise<DailyTimerStats[]>;
}
