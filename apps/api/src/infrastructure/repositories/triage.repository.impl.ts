import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../database/client";
import { taskTriage } from "../database/schema";
import type { TriageRepository } from "../../domain/triage/triage.repository";
import type { TaskTriage, SetTriageInput, TriageStatus } from "../../domain/triage/triage.entity";

export class DrizzleTriageRepository implements TriageRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<TaskTriage[]> {
    const rows = await this.db.select().from(taskTriage).orderBy(taskTriage.triagedAt);
    return rows.map(this.toDomain);
  }

  async findByStatus(status: TriageStatus): Promise<TaskTriage[]> {
    const rows = await this.db.select().from(taskTriage)
      .where(eq(taskTriage.triageStatus, status))
      .orderBy(taskTriage.triagedAt);
    return rows.map(this.toDomain);
  }

  async findByTaskId(taskId: string): Promise<TaskTriage | null> {
    const rows = await this.db.select().from(taskTriage)
      .where(eq(taskTriage.taskId, taskId))
      .limit(1);
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async upsert(input: SetTriageInput): Promise<TaskTriage> {
    const rows = await this.db
      .insert(taskTriage)
      .values({
        taskId: input.taskId,
        triageStatus: input.triageStatus,
        triagedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: taskTriage.taskId,
        set: {
          triageStatus: input.triageStatus,
          triagedAt: new Date(),
        },
      })
      .returning();

    return this.toDomain(rows[0]);
  }

  async bulkUpsert(inputs: SetTriageInput[]): Promise<void> {
    if (inputs.length === 0) return;
    for (const input of inputs) {
      await this.upsert(input);
    }
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    await this.db.delete(taskTriage).where(eq(taskTriage.taskId, taskId));
  }

  async deleteAll(): Promise<void> {
    await this.db.delete(taskTriage);
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.db
      .select({
        status: taskTriage.triageStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(taskTriage)
      .groupBy(taskTriage.triageStatus);

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.status] = Number(row.count);
    }
    return result;
  }

  async countByDateRange(from: Date, to: Date): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(taskTriage)
      .where(and(gte(taskTriage.triagedAt, from), lte(taskTriage.triagedAt, to)));
    return Number(rows[0]?.count ?? 0);
  }

  private toDomain(row: typeof taskTriage.$inferSelect): TaskTriage {
    return {
      id: row.id,
      taskId: row.taskId,
      triageStatus: row.triageStatus as TriageStatus,
      triagedAt: row.triagedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
