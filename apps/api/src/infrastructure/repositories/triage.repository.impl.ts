import { eq } from "drizzle-orm";
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

  async findByClickupTaskId(clickupTaskId: string): Promise<TaskTriage | null> {
    const rows = await this.db.select().from(taskTriage)
      .where(eq(taskTriage.clickupTaskId, clickupTaskId))
      .limit(1);
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async upsert(input: SetTriageInput): Promise<TaskTriage> {
    const rows = await this.db
      .insert(taskTriage)
      .values({
        clickupTaskId: input.clickupTaskId,
        triageStatus: input.triageStatus,
        triagedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: taskTriage.clickupTaskId,
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

  async deleteByClickupTaskId(clickupTaskId: string): Promise<void> {
    await this.db.delete(taskTriage).where(eq(taskTriage.clickupTaskId, clickupTaskId));
  }

  async deleteAll(): Promise<void> {
    await this.db.delete(taskTriage);
  }

  private toDomain(row: typeof taskTriage.$inferSelect): TaskTriage {
    return {
      id: row.id,
      clickupTaskId: row.clickupTaskId,
      triageStatus: row.triageStatus as TriageStatus,
      triagedAt: row.triagedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
