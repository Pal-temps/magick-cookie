import { eq, and, lte, isNull, sql } from "drizzle-orm";
import type { Database } from "../database/client";
import { reminders } from "../database/schema";
import type { ReminderRepository } from "../../domain/reminder/reminder.repository";
import type { Reminder, CreateReminderInput } from "../../domain/reminder/reminder.entity";

export class DrizzleReminderRepository implements ReminderRepository {
  constructor(private db: Database) {}

  async findByEventId(eventId: string): Promise<Reminder[]> {
    const rows = await this.db.select().from(reminders).where(eq(reminders.eventId, eventId));
    return rows.map(this.toDomain);
  }

  async findPending(): Promise<Reminder[]> {
    const rows = await this.db.select().from(reminders).where(
      and(
        lte(reminders.scheduledAt, new Date()),
        isNull(reminders.sentAt),
      )
    ).orderBy(reminders.scheduledAt);
    return rows.map(this.toDomain);
  }

  async create(input: CreateReminderInput): Promise<Reminder> {
    const rows = await this.db.insert(reminders).values({
      eventId: input.eventId,
      type: input.type ?? "push",
      minutesBefore: input.minutesBefore ?? 15,
      scheduledAt: input.scheduledAt,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(reminders).where(eq(reminders.id, id)).returning({ id: reminders.id });
    return rows.length > 0;
  }

  async deleteByEventId(eventId: string): Promise<void> {
    await this.db.delete(reminders).where(eq(reminders.eventId, eventId));
  }

  async markAsSent(id: string): Promise<void> {
    await this.db.update(reminders).set({ sentAt: new Date() }).where(eq(reminders.id, id));
  }

  async updateScheduledAt(eventId: string, newStartAt: Date): Promise<void> {
    await this.db.update(reminders)
      .set({
        scheduledAt: sql`${newStartAt} - (minutes_before * interval '1 minute')`,
      })
      .where(and(eq(reminders.eventId, eventId), isNull(reminders.sentAt)));
  }

  private toDomain(row: typeof reminders.$inferSelect): Reminder {
    return {
      id: row.id,
      eventId: row.eventId,
      type: row.type,
      minutesBefore: row.minutesBefore,
      scheduledAt: row.scheduledAt,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
    };
  }
}
