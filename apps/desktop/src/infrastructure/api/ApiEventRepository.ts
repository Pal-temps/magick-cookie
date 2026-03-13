import type { EventRepository } from "../../domain/ports/EventRepository";
import type { CalendarEvent, CreateEventDTO, UpdateEventDTO } from "../../domain/models/CalendarEvent";
import type { DateRange } from "../../domain/models/types";
import { api } from "./apiClient";

export class ApiEventRepository implements EventRepository {
  async getAll(filters?: DateRange & { calendarId?: string }): Promise<CalendarEvent[]> {
    const params = new URLSearchParams();
    if (filters?.from) params.set("from", filters.from.toISOString());
    if (filters?.to) params.set("to", filters.to.toISOString());
    if (filters?.calendarId) params.set("calendarId", filters.calendarId);
    const qs = params.toString();
    return api.get<CalendarEvent[]>(`/events${qs ? `?${qs}` : ""}`);
  }

  async getByCalendarId(calendarId: string, range?: DateRange): Promise<CalendarEvent[]> {
    const params = new URLSearchParams();
    if (range?.from) params.set("from", range.from.toISOString());
    if (range?.to) params.set("to", range.to.toISOString());
    const qs = params.toString();
    return api.get<CalendarEvent[]>(`/calendars/${calendarId}/events${qs ? `?${qs}` : ""}`);
  }

  async getById(id: string): Promise<CalendarEvent> {
    return api.get<CalendarEvent>(`/events/${id}`);
  }

  async create(calendarId: string, input: CreateEventDTO): Promise<CalendarEvent> {
    return api.post<CalendarEvent>(`/calendars/${calendarId}/events`, input);
  }

  async update(id: string, input: UpdateEventDTO): Promise<CalendarEvent> {
    return api.put<CalendarEvent>(`/events/${id}`, input);
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/events/${id}`);
  }
}
