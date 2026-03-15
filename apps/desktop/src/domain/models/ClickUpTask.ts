export interface UnscheduledTask {
  id: string;
  clickupTaskId: string;
  name: string;
  description: string | null;
  status: string;
  url: string;
  listName: string;
  priority: string | null;
  assignees: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SyncResult {
  eventsCreated: number;
  eventsUpdated: number;
  unscheduledCount: number;
}

export interface ClickUpComment {
  id: string;
  commentText: string;
  user: { username: string; initials: string };
  date: string;
}

export interface TaskDetailData {
  description: string | null;
  comments: ClickUpComment[];
}
