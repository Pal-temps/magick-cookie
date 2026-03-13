import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { calendars } from "../database/schema";
import type { CalendarRepository } from "../../domain/calendar/calendar.repository";
import type { Calendar, CreateCalendarInput, UpdateCalendarInput } from "../../domain/calendar/calendar.entity";

export class DrizzleCalendarRepository implements CalendarRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<Calendar[]> {
    const rows = await this.db.select().from(calendars).orderBy(calendars.createdAt);
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<Calendar | null> {
    const rows = await this.db.select().from(calendars).where(eq(calendars.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateCalendarInput): Promise<Calendar> {
    const rows = await this.db.insert(calendars).values({
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? "#6c5ce7",
      isDefault: input.isDefault ?? false,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateCalendarInput): Promise<Calendar | null> {
    const values: Record<string, unknown> = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined) values.description = input.description;
    if (input.color !== undefined) values.color = input.color;
    if (input.isDefault !== undefined) values.isDefault = input.isDefault;

    const rows = await this.db.update(calendars).set(values).where(eq(calendars.id, id)).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(calendars).where(eq(calendars.id, id)).returning({ id: calendars.id });
    return rows.length > 0;
  }

  private toDomain(row: typeof calendars.$inferSelect): Calendar {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      color: row.color,
      isDefault: row.isDefault,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
