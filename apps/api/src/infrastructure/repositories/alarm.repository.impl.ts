import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { alarms } from "../database/schema";
import type { AlarmRepository } from "../../domain/alarm/alarm.repository";
import type { Alarm, CreateAlarmInput, UpdateAlarmInput, RepeatPattern } from "../../domain/alarm/alarm.entity";

export class DrizzleAlarmRepository implements AlarmRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<Alarm[]> {
    const rows = await this.db.select().from(alarms).orderBy(alarms.time);
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<Alarm | null> {
    const rows = await this.db.select().from(alarms).where(eq(alarms.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findEnabled(): Promise<Alarm[]> {
    const rows = await this.db.select().from(alarms).where(eq(alarms.enabled, true)).orderBy(alarms.time);
    return rows.map(this.toDomain);
  }

  async create(input: CreateAlarmInput): Promise<Alarm> {
    const rows = await this.db.insert(alarms).values({
      time: input.time,
      label: input.label,
      repeatPattern: input.repeatPattern ?? "once",
      repeatDays: input.repeatDays ? input.repeatDays.join(",") : null,
      enabled: input.enabled ?? true,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateAlarmInput): Promise<Alarm | null> {
    const values: Record<string, unknown> = {};
    if (input.time !== undefined) values.time = input.time;
    if (input.label !== undefined) values.label = input.label;
    if (input.repeatPattern !== undefined) values.repeatPattern = input.repeatPattern;
    if (input.repeatDays !== undefined) values.repeatDays = input.repeatDays ? input.repeatDays.join(",") : null;
    if (input.enabled !== undefined) values.enabled = input.enabled;

    const rows = await this.db.update(alarms).set(values).where(eq(alarms.id, id)).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(alarms).where(eq(alarms.id, id)).returning({ id: alarms.id });
    return rows.length > 0;
  }

  async markFired(id: string): Promise<void> {
    await this.db.update(alarms).set({ lastFiredAt: new Date() }).where(eq(alarms.id, id));
  }

  private toDomain(row: typeof alarms.$inferSelect): Alarm {
    return {
      id: row.id,
      time: row.time,
      label: row.label,
      repeatPattern: row.repeatPattern as RepeatPattern,
      repeatDays: row.repeatDays ? row.repeatDays.split(",").map(Number) : null,
      enabled: row.enabled,
      lastFiredAt: row.lastFiredAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
