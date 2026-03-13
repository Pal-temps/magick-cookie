import { useCalendarStore } from "../stores/calendarStore";

export async function deleteEvent(id: string) {
  const store = useCalendarStore();
  return store.deleteEvent(id);
}
