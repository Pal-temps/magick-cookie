import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../database/client";
import { timerSessions } from "../database/schema";
import type { TimerSessionRepository } from "../../domain/timer-session/timer-session.repository";
import type { TimerSession, CreateTimerSessionInput } from "../../domain/timer-session/timer-session.entity";

export class DrizzleTimerSessionRepository implements TimerSessionRepository {
  constructor(private db: Database) {}

  async findAll(from?: Date, to?: Date): Promise<TimerSession[]> {
    const conditions = [];
    if (from) conditions.push(gte(timerSessions.startedAt, from));
    if (to) conditions.push(lte(timerSessions.startedAt, to));

    const query = this.db.select().from(timerSessions);
    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(timerSessions.startedAt)
      : await query.orderBy(timerSessions.startedAt);
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<TimerSession | null> {
    const rows = await this.db.select().from(timerSessions).where(eq(timerSessions.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateTimerSessionInput): Promise<TimerSession> {
    const rows = await this.db.insert(timerSessions).values({
      mode: input.mode,
      durationMinutes: input.durationMinutes,
      actualSeconds: input.actualSeconds,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      completed: input.completed ?? true,
      label: input.label ?? null,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async getTodayStats(): Promise<{ totalSeconds: number; sessionCount: number }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const result = await this.db
      .select({
        totalSeconds: sql<number>`coalesce(sum(${timerSessions.actualSeconds}), 0)`,
        sessionCount: sql<number>`count(*)::int`,
      })
      .from(timerSessions)
      .where(
        and(
          gte(timerSessions.startedAt, startOfDay),
          lte(timerSessions.startedAt, endOfDay),
        )
      );

    return {
      totalSeconds: Number(result[0]?.totalSeconds ?? 0),
      sessionCount: Number(result[0]?.sessionCount ?? 0),
    };
  }

  private toDomain(row: typeof timerSessions.$inferSelect): TimerSession {
    return {
      id: row.id,
      mode: row.mode,
      durationMinutes: row.durationMinutes,
      actualSeconds: row.actualSeconds,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      completed: row.completed,
      label: row.label,
      createdAt: row.createdAt,
    };
  }
}
