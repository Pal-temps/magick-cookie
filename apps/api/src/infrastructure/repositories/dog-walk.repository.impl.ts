import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";
import type { Database } from "../database/client";
import { dogWalks } from "../database/schema";
import type { DogWalkRepository } from "../../domain/dog-walk/dog-walk.repository";
import type { DogWalk, CreateDogWalkInput, StopDogWalkInput } from "../../domain/dog-walk/dog-walk.entity";

export class DrizzleDogWalkRepository implements DogWalkRepository {
  constructor(private db: Database) {}

  async findActive(): Promise<DogWalk | null> {
    const rows = await this.db
      .select()
      .from(dogWalks)
      .where(isNull(dogWalks.endedAt))
      .limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findAll(from?: Date, to?: Date): Promise<DogWalk[]> {
    const conditions = [];
    if (from) conditions.push(gte(dogWalks.startedAt, from));
    if (to) conditions.push(lte(dogWalks.startedAt, to));

    const query = this.db.select().from(dogWalks);
    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(dogWalks.startedAt)
      : await query.orderBy(dogWalks.startedAt);
    return rows.map(this.toDomain);
  }

  async create(input: CreateDogWalkInput): Promise<DogWalk> {
    const rows = await this.db.insert(dogWalks).values({
      startedAt: input.startedAt ?? new Date(),
      notes: input.notes ?? null,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async stop(id: string, input: StopDogWalkInput): Promise<DogWalk> {
    const rows = await this.db
      .update(dogWalks)
      .set({
        endedAt: input.endedAt,
        durationSeconds: input.durationSeconds,
      })
      .where(eq(dogWalks.id, id))
      .returning();
    return this.toDomain(rows[0]);
  }

  async getTodayStats(): Promise<{ totalSeconds: number; walkCount: number }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const result = await this.db
      .select({
        totalSeconds: sql<number>`coalesce(sum(${dogWalks.durationSeconds}), 0)`,
        walkCount: sql<number>`cast(count(*) filter (where ${dogWalks.endedAt} is not null) as integer)`,
      })
      .from(dogWalks)
      .where(and(gte(dogWalks.startedAt, startOfDay), lte(dogWalks.startedAt, endOfDay)));

    return {
      totalSeconds: Number(result[0]?.totalSeconds ?? 0),
      walkCount: Number(result[0]?.walkCount ?? 0),
    };
  }

  async getDailyStats(from: Date, to: Date): Promise<{ date: string; totalSeconds: number; walkCount: number }[]> {
    const rows = await this.db
      .select({
        date: sql<string>`strftime('%Y-%m-%d', datetime(${dogWalks.startedAt} / 1000, 'unixepoch'))`,
        totalSeconds: sql<number>`coalesce(sum(${dogWalks.durationSeconds}), 0)`,
        walkCount: sql<number>`cast(count(*) filter (where ${dogWalks.endedAt} is not null) as integer)`,
      })
      .from(dogWalks)
      .where(and(gte(dogWalks.startedAt, from), lte(dogWalks.startedAt, to)))
      .groupBy(sql`strftime('%Y-%m-%d', datetime(${dogWalks.startedAt} / 1000, 'unixepoch'))`)
      .orderBy(sql`strftime('%Y-%m-%d', datetime(${dogWalks.startedAt} / 1000, 'unixepoch'))`);

    return rows.map((r) => ({
      date: r.date,
      totalSeconds: Number(r.totalSeconds),
      walkCount: Number(r.walkCount),
    }));
  }

  private toDomain(row: typeof dogWalks.$inferSelect): DogWalk {
    return {
      id: row.id,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationSeconds: row.durationSeconds,
      notes: row.notes,
      createdAt: row.createdAt,
    };
  }
}
