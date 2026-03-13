import { eq, and, gte, lte } from "drizzle-orm";
import type { Database } from "../database/client";
import { events } from "../database/schema";
import type { EventRepository } from "../../domain/event/event.repository";
import type { CalendarEvent, CreateEventInput, UpdateEventInput, EventQueryFilters } from "../../domain/event/event.entity";

export class DrizzleEventRepository implements EventRepository {
  constructor(private db: Database) {}

  async findAll(filters: EventQueryFilters): Promise<CalendarEvent[]> {
    const conditions = [];
    if (filters.calendarId) conditions.push(eq(events.calendarId, filters.calendarId));
    if (filters.from) conditions.push(gte(events.endAt, filters.from));
    if (filters.to) conditions.push(lte(events.startAt, filters.to));

    const query = this.db.select().from(events);
    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(events.startAt)
      : await query.orderBy(events.startAt);
    return rows.map(this.toDomain);
  }

  async findByCalendarId(calendarId: string, filters: Omit<EventQueryFilters, "calendarId">): Promise<CalendarEvent[]> {
    return this.findAll({ ...filters, calendarId });
  }

  async findById(id: string): Promise<CalendarEvent | null> {
    const rows = await this.db.select().from(events).where(eq(events.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByClickUpTaskId(clickupTaskId: string): Promise<CalendarEvent | null> {
    const rows = await this.db.select().from(events).where(eq(events.clickupTaskId, clickupTaskId));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateEventInput): Promise<CalendarEvent> {
    const rows = await this.db.insert(events).values({
      calendarId: input.calendarId,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      isAllDay: input.isAllDay ?? false,
      recurrenceRule: input.recurrenceRule ?? null,
      clickupTaskId: input.clickupTaskId ?? null,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateEventInput): Promise<CalendarEvent | null> {
    const values: Record<string, unknown> = {};
    if (input.title !== undefined) values.title = input.title;
    if (input.description !== undefined) values.description = input.description;
    if (input.location !== undefined) values.location = input.location;
    if (input.startAt !== undefined) values.startAt = input.startAt;
    if (input.endAt !== undefined) values.endAt = input.endAt;
    if (input.isAllDay !== undefined) values.isAllDay = input.isAllDay;
    if (input.recurrenceRule !== undefined) values.recurrenceRule = input.recurrenceRule;

    const rows = await this.db.update(events).set(values).where(eq(events.id, id)).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(events).where(eq(events.id, id)).returning({ id: events.id });
    return rows.length > 0;
  }

  private toDomain(row: typeof events.$inferSelect): CalendarEvent {
    return {
      id: row.id,
      calendarId: row.calendarId,
      title: row.title,
      description: row.description,
      location: row.location,
      startAt: row.startAt,
      endAt: row.endAt,
      isAllDay: row.isAllDay,
      recurrenceRule: row.recurrenceRule,
      clickupTaskId: row.clickupTaskId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
