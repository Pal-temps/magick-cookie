import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../database/client";
import { wellnessLogs } from "../database/schema";
import type { WellnessLogRepository } from "../../domain/wellness-log/wellness-log.repository";
import type { WellnessLog, UpsertWellnessLogInput } from "../../domain/wellness-log/wellness-log.entity";

export class DrizzleWellnessLogRepository implements WellnessLogRepository {
  constructor(private db: Database) {}

  async findByDateAndType(date: string, type: string): Promise<WellnessLog | null> {
    const rows = await this.db.select().from(wellnessLogs)
      .where(and(eq(wellnessLogs.date, date), eq(wellnessLogs.type, type)));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByDate(date: string): Promise<WellnessLog[]> {
    const rows = await this.db.select().from(wellnessLogs)
      .where(eq(wellnessLogs.date, date))
      .orderBy(wellnessLogs.type);
    return rows.map(this.toDomain);
  }

  async findByRange(from: string, to: string, type?: string): Promise<WellnessLog[]> {
    const conditions = [
      gte(wellnessLogs.date, from),
      lte(wellnessLogs.date, to),
    ];
    if (type) conditions.push(eq(wellnessLogs.type, type));

    const rows = await this.db.select().from(wellnessLogs)
      .where(and(...conditions))
      .orderBy(wellnessLogs.date);
    return rows.map(this.toDomain);
  }

  async upsert(input: UpsertWellnessLogInput): Promise<WellnessLog> {
    const existing = await this.findByDateAndType(input.date, input.type);

    if (existing) {
      const rows = await this.db.update(wellnessLogs).set({
        value: input.value,
        goal: input.goal,
      }).where(eq(wellnessLogs.id, existing.id)).returning();
      return this.toDomain(rows[0]);
    }

    const rows = await this.db.insert(wellnessLogs).values({
      type: input.type,
      date: input.date,
      value: input.value,
      goal: input.goal,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async increment(date: string, type: string, amount: number): Promise<WellnessLog | null> {
    const rows = await this.db.update(wellnessLogs).set({
      value: sql`GREATEST(0, ${wellnessLogs.value} + ${amount})`,
    }).where(
      and(eq(wellnessLogs.date, date), eq(wellnessLogs.type, type))
    ).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  private toDomain(row: typeof wellnessLogs.$inferSelect): WellnessLog {
    return {
      id: row.id,
      type: row.type,
      date: row.date,
      value: row.value,
      goal: row.goal,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
