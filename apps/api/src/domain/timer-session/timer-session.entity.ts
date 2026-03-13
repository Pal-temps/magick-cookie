export interface TimerSession {
  id: string;
  mode: string;
  durationMinutes: number;
  actualSeconds: number;
  startedAt: Date;
  endedAt: Date;
  completed: boolean;
  label: string | null;
  createdAt: Date;
}

export interface CreateTimerSessionInput {
  mode: string;
  durationMinutes: number;
  actualSeconds: number;
  startedAt: Date;
  endedAt: Date;
  completed?: boolean;
  label?: string | null;
}
