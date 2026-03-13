import type { CalendarEvent } from "../models/CalendarEvent";

export function hasOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  const aStart = new Date(a.startAt).getTime();
  const aEnd = new Date(a.endAt).getTime();
  const bStart = new Date(b.startAt).getTime();
  const bEnd = new Date(b.endAt).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function findOverlaps(event: CalendarEvent, events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((e) => e.id !== event.id && hasOverlap(event, e));
}
