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
