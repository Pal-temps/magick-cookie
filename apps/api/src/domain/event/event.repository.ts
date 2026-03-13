import type { CalendarEvent, CreateEventInput, UpdateEventInput, EventQueryFilters } from "./event.entity";

export interface EventRepository {
  findAll(filters: EventQueryFilters): Promise<CalendarEvent[]>;
  findByCalendarId(calendarId: string, filters: Omit<EventQueryFilters, "calendarId">): Promise<CalendarEvent[]>;
  findById(id: string): Promise<CalendarEvent | null>;
  findByClickUpTaskId(clickupTaskId: string): Promise<CalendarEvent | null>;
  create(input: CreateEventInput): Promise<CalendarEvent>;
  update(id: string, input: UpdateEventInput): Promise<CalendarEvent | null>;
  delete(id: string): Promise<boolean>;
}
