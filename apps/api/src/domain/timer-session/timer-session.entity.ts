export interface TimerSession {
  id: string;
  mode: string;
  durationMinutes: number;
  actualSeconds: number;
  startedAt: Date;
  endedAt: Date;
  completed: boolean;
  label: string | null;
  taskId: string | null;
  projectId: string | null;
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
  taskId?: string;
  projectId?: string | null;
}
