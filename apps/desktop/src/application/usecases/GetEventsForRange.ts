import { useCalendarStore } from "../stores/calendarStore";

export async function getEventsForRange(from: Date, to: Date) {
  const store = useCalendarStore();
  return store.fetchEvents(from, to);
}
