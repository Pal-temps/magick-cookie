import { eq, notInArray } from "drizzle-orm";
import type { Database } from "../database/client";
import { clickupUnscheduledTasks } from "../database/schema";
import type { ClickUpConnectorRepository } from "../../domain/connector/clickup.repository";
import type { UnscheduledTask } from "../../domain/connector/clickup.entity";

export class DrizzleClickUpConnectorRepository implements ClickUpConnectorRepository {
  constructor(private db: Database) {}

  async findUnscheduledTasks(): Promise<UnscheduledTask[]> {
    const rows = await this.db.select().from(clickupUnscheduledTasks).orderBy(clickupUnscheduledTasks.createdAt);
    return rows.map(this.toDomain);
  }

  async upsertUnscheduledTask(task: Omit<UnscheduledTask, "id" | "createdAt" | "updatedAt">): Promise<UnscheduledTask> {
    const rows = await this.db
      .insert(clickupUnscheduledTasks)
      .values({
        clickupTaskId: task.clickupTaskId,
        name: task.name,
        description: task.description,
        status: task.status,
        url: task.url,
        listName: task.listName,
        priority: task.priority,
        assignees: JSON.stringify(task.assignees),
      })
      .onConflictDoUpdate({
        target: clickupUnscheduledTasks.clickupTaskId,
        set: {
          name: task.name,
          description: task.description,
          status: task.status,
          url: task.url,
          listName: task.listName,
          priority: task.priority,
          assignees: JSON.stringify(task.assignees),
        },
      })
      .returning();

    return this.toDomain(rows[0]);
  }

  async deleteUnscheduledTasksNotIn(clickupTaskIds: string[]): Promise<void> {
    if (clickupTaskIds.length === 0) {
      await this.db.delete(clickupUnscheduledTasks);
      return;
    }
    await this.db
      .delete(clickupUnscheduledTasks)
      .where(notInArray(clickupUnscheduledTasks.clickupTaskId, clickupTaskIds));
  }

  private toDomain(row: typeof clickupUnscheduledTasks.$inferSelect): UnscheduledTask {
    return {
      id: row.id,
      clickupTaskId: row.clickupTaskId,
      name: row.name,
      description: row.description,
      status: row.status,
      url: row.url,
      listName: row.listName,
      priority: row.priority,
      assignees: JSON.parse(row.assignees) as string[],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
