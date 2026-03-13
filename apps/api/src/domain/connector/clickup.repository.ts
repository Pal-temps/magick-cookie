import type { UnscheduledTask } from "./clickup.entity";

export interface ClickUpConnectorRepository {
  findUnscheduledTasks(): Promise<UnscheduledTask[]>;
  upsertUnscheduledTask(task: Omit<UnscheduledTask, "id" | "createdAt" | "updatedAt">): Promise<UnscheduledTask>;
  deleteUnscheduledTasksNotIn(clickupTaskIds: string[]): Promise<void>;
}
