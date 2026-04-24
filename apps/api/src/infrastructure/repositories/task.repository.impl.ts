import { eq, and, isNull, inArray, notInArray, sql, desc, count } from "drizzle-orm";
import type { Database } from "../database/client";
import { tasks } from "../database/schema";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { Task, TaskSource, CreateTaskInput, UpdateTaskInput } from "../../domain/task/task.entity";

export class DrizzleTaskRepository implements TaskRepository {
  constructor(private db: Database) {}

  async findAll(options?: { source?: string; limit?: number; offset?: number }): Promise<Task[]> {
    let query = this.db.select().from(tasks).$dynamic();
    if (options?.source) {
      query = query.where(eq(tasks.source, options.source));
    }
    const rows = await query
      .orderBy(desc(tasks.createdAt))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<Task | null> {
    const rows = await this.db.select().from(tasks).where(eq(tasks.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<Task[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select().from(tasks).where(inArray(tasks.id, ids));
    return rows.map(this.toDomain);
  }

  async findByExternalId(externalId: string, source: TaskSource): Promise<Task | null> {
    const rows = await this.db.select().from(tasks)
      .where(and(eq(tasks.externalId, externalId), eq(tasks.source, source)));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findBySource(source: TaskSource): Promise<Task[]> {
    const rows = await this.db.select().from(tasks)
      .where(eq(tasks.source, source))
      .orderBy(tasks.createdAt);
    return rows.map(this.toDomain);
  }

  async findUnscheduled(options?: { limit?: number; offset?: number }): Promise<Task[]> {
    const rows = await this.db.select().from(tasks)
      .where(isNull(tasks.dueDate))
      .orderBy(desc(tasks.createdAt))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);
    return rows.map(this.toDomain);
  }

  async countAll(source?: string): Promise<number> {
    const condition = source ? eq(tasks.source, source) : undefined;
    const rows = await this.db.select({ value: count() }).from(tasks).where(condition);
    return rows[0]?.value ?? 0;
  }

  async countUnscheduled(): Promise<number> {
    const rows = await this.db.select({ value: count() }).from(tasks).where(isNull(tasks.dueDate));
    return rows[0]?.value ?? 0;
  }

  async upsertByExternalId(input: CreateTaskInput): Promise<Task> {
    const rows = await this.db
      .insert(tasks)
      .values({
        externalId: input.externalId ?? null,
        source: input.source,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "open",
        priority: input.priority ?? null,
        url: input.url ?? null,
        labels: JSON.stringify(input.labels ?? []),
        assignees: JSON.stringify(input.assignees ?? []),
        dueDate: input.dueDate ?? null,
        startDate: input.startDate ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })
      .onConflictDoUpdate({
        target: [tasks.externalId, tasks.source],
        set: {
          title: input.title,
          description: input.description ?? null,
          status: input.status ?? "open",
          priority: input.priority ?? null,
          url: input.url ?? null,
          labels: JSON.stringify(input.labels ?? []),
          assignees: JSON.stringify(input.assignees ?? []),
          dueDate: input.dueDate ?? null,
          startDate: input.startDate ?? null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        },
      })
      .returning();

    return this.toDomain(rows[0]);
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const rows = await this.db
      .insert(tasks)
      .values({
        externalId: input.externalId ?? null,
        source: input.source,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "open",
        priority: input.priority ?? null,
        url: input.url ?? null,
        labels: JSON.stringify(input.labels ?? []),
        assignees: JSON.stringify(input.assignees ?? []),
        dueDate: input.dueDate ?? null,
        startDate: input.startDate ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })
      .returning();

    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    const set: Record<string, unknown> = {};
    if (input.title !== undefined) set.title = input.title;
    if (input.description !== undefined) set.description = input.description;
    if (input.status !== undefined) set.status = input.status;
    if (input.priority !== undefined) set.priority = input.priority;
    if (input.startDate !== undefined) set.startDate = input.startDate;
    if (input.dueDate !== undefined) set.dueDate = input.dueDate;

    if (Object.keys(set).length === 0) {
      return this.findById(id);
    }

    const rows = await this.db
      .update(tasks)
      .set(set)
      .where(eq(tasks.id, id))
      .returning();

    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async deleteBySource(source: TaskSource): Promise<void> {
    await this.db.delete(tasks).where(eq(tasks.source, source));
  }

  async deleteNotInExternalIds(source: TaskSource, externalIds: string[]): Promise<void> {
    if (externalIds.length === 0) {
      await this.db.delete(tasks).where(eq(tasks.source, source));
      return;
    }
    await this.db
      .delete(tasks)
      .where(and(eq(tasks.source, source), notInArray(tasks.externalId, externalIds)));
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(tasks).where(eq(tasks.id, id)).returning({ id: tasks.id });
    return rows.length > 0;
  }

  private toDomain(row: typeof tasks.$inferSelect): Task {
    return {
      id: row.id,
      externalId: row.externalId,
      source: row.source as TaskSource,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      url: row.url,
      labels: safeJsonParse<string[]>(row.labels, []),
      assignees: safeJsonParse<string[]>(row.assignees, []),
      dueDate: row.dueDate,
      startDate: row.startDate,
      metadata: safeJsonParse<Record<string, unknown> | null>(row.metadata, null),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
