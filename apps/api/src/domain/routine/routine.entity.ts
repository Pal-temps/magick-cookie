export type RoutineStep =
  | { action: "navigate"; view: string }
  | { action: "sync"; target: "email" | "rss" | "github" }
  | { action: "generate"; target: "brief" | "changelog" | "rss-digest" }
  | { action: "notify"; title: string; body: string };

export interface Routine {
  id: string;
  name: string;
  triggerTime: string;
  triggerDays: number[];
  steps: RoutineStep[];
  enabled: boolean;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoutineInput {
  name: string;
  triggerTime: string;
  triggerDays?: number[];
  steps?: RoutineStep[];
  enabled?: boolean;
}

export interface UpdateRoutineInput {
  name?: string;
  triggerTime?: string;
  triggerDays?: number[];
  steps?: RoutineStep[];
  enabled?: boolean;
}
