import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../database/client";
import { timerSessions } from "../database/schema";
import type { TimerSessionRepository, DailyTimerStats } from "../../domain/timer-session/timer-session.repository";
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

  async findByTaskId(taskId: string, from?: Date, to?: Date): Promise<TimerSession[]> {
    const conditions = [eq(timerSessions.taskId, taskId)];
    if (from) conditions.push(gte(timerSessions.startedAt, from));
    if (to) conditions.push(lte(timerSessions.startedAt, to));

    const rows = await this.db
      .select()
      .from(timerSessions)
      .where(and(...conditions))
      .orderBy(timerSessions.startedAt);
    return rows.map(this.toDomain);
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
      taskId: input.taskId ?? null,
      projectId: input.projectId ?? null,
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
        sessionCount: sql<number>`cast(count(*) as integer)`,
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

  async getDailyStats(from: Date, to: Date): Promise<DailyTimerStats[]> {
    const rows = await this.db
      .select({
        date: sql<string>`strftime('%Y-%m-%d', datetime(${timerSessions.startedAt} / 1000, 'unixepoch'))`,
        totalSeconds: sql<number>`coalesce(sum(${timerSessions.actualSeconds}), 0)`,
        focusSeconds: sql<number>`coalesce(sum(case when ${timerSessions.completed} = 1 then ${timerSessions.actualSeconds} else 0 end), 0)`,
        sessionCount: sql<number>`cast(count(*) as integer)`,
        completedCount: sql<number>`cast(count(*) filter (where ${timerSessions.completed} = 1) as integer)`,
        cancelledCount: sql<number>`cast(count(*) filter (where ${timerSessions.completed} = 0) as integer)`,
      })
      .from(timerSessions)
      .where(and(gte(timerSessions.startedAt, from), lte(timerSessions.startedAt, to)))
      .groupBy(sql`strftime('%Y-%m-%d', datetime(${timerSessions.startedAt} / 1000, 'unixepoch'))`)
      .orderBy(sql`strftime('%Y-%m-%d', datetime(${timerSessions.startedAt} / 1000, 'unixepoch'))`);

    return rows.map((r) => ({
      date: r.date,
      totalSeconds: Number(r.totalSeconds),
      focusSeconds: Number(r.focusSeconds),
      sessionCount: Number(r.sessionCount),
      completedCount: Number(r.completedCount),
      cancelledCount: Number(r.cancelledCount),
    }));
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
      taskId: row.taskId,
      projectId: row.projectId,
      createdAt: row.createdAt,
    };
  }
}
