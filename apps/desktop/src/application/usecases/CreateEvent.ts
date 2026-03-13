import type { CreateEventDTO } from "../../domain/models/CalendarEvent";
import { useCalendarStore } from "../stores/calendarStore";

export async function createEvent(calendarId: string, input: CreateEventDTO) {
  const store = useCalendarStore();
  return store.createEvent(calendarId, input);
}
