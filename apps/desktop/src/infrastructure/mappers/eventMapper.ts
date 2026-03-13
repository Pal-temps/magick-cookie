import type { CalendarEvent } from "../../domain/models/CalendarEvent";

export function eventToDateKey(event: CalendarEvent): string {
  return new Date(event.startAt).toISOString().slice(0, 10);
}

export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = eventToDateKey(event);
    const list = map.get(key) ?? [];
    list.push(event);
    map.set(key, list);
  }
  return map;
}
