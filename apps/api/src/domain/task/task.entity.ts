export type TaskSource = "clickup" | "manual";

export interface Task {
  id: string;
  externalId: string | null;
  source: TaskSource;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  url: string | null;
  labels: string[];
  assignees: string[];
  dueDate: Date | null;
  startDate: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  externalId?: string | null;
  source: TaskSource;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string | null;
  url?: string | null;
  labels?: string[];
  assignees?: string[];
  dueDate?: Date | null;
  startDate?: Date | null;
  metadata?: Record<string, unknown> | null;
}
