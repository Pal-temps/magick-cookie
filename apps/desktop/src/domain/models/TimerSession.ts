export interface TimerSession {
  id: string;
  mode: string;
  durationMinutes: number;
  actualSeconds: number;
  startedAt: string;
  endedAt: string;
  completed: boolean;
  label: string | null;
  createdAt: string;
}

export interface CreateTimerSessionDTO {
  mode: string;
  durationMinutes: number;
  actualSeconds: number;
  startedAt: string;
  endedAt: string;
  completed?: boolean;
  label?: string | null;
}

export interface TimerStats {
  totalSeconds: number;
  sessionCount: number;
}
