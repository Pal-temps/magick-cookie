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
  dueDate: string | null;
  startDate: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  commentText: string;
  user: { username: string; initials: string };
  date: string;
}

export interface TaskDetailData {
  description: string | null;
  comments: TaskComment[];
}

export interface SyncResult {
  eventsCreated: number;
  eventsUpdated: number;
  taskCount: number;
}
