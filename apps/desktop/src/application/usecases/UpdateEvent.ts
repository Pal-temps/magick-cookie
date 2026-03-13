import type { UpdateEventDTO } from "../../domain/models/CalendarEvent";
import { useCalendarStore } from "../stores/calendarStore";

export async function updateEvent(id: string, input: UpdateEventDTO) {
  const store = useCalendarStore();
  return store.updateEvent(id, input);
}
