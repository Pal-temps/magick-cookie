import type { CalendarEvent, CreateEventDTO, UpdateEventDTO } from "../models/CalendarEvent";
import type { DateRange } from "../models/types";

export interface EventRepository {
  getAll(filters?: DateRange & { calendarId?: string }): Promise<CalendarEvent[]>;
  getByCalendarId(calendarId: string, range?: DateRange): Promise<CalendarEvent[]>;
  getById(id: string): Promise<CalendarEvent>;
  create(calendarId: string, input: CreateEventDTO): Promise<CalendarEvent>;
  update(id: string, input: UpdateEventDTO): Promise<CalendarEvent>;
  delete(id: string): Promise<void>;
}
