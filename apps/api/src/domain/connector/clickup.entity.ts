export interface ClickUpTask {
  id: string;
  name: string;
  description: string | null;
  status: string;
  dueDate: Date | null;
  startDate: Date | null;
  url: string;
  listName: string;
  spaceName: string;
  priority: string | null;
  assignees: string[];
}

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
  createdAt: Date;
  updatedAt: Date;
}
