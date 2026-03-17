import { onMount, onCleanup, createEffect, Show } from "solid-js";
import { AppLayout } from "./ui/layouts/AppLayout";
import { DesktopWidgets } from "./ui/layouts/DesktopWidgets";
import { CalendarGrid } from "./ui/components/calendar/CalendarGrid";
import { EventForm } from "./ui/components/events/EventForm";
import { NotesView } from "./ui/components/notes/NotesView";
import { TriageView } from "./ui/components/triage/TriageView";
import { EmailView } from "./ui/components/email/EmailView";
import { SettingsView } from "./ui/components/settings/SettingsView";
import { useCalendarStore } from "./application/stores/calendarStore";
import { useViewStore } from "./application/stores/viewStore";
import { useWellnessStore } from "./application/stores/wellnessStore";
import { useTimerStore } from "./application/stores/timerStore";
import { useDogWalkStore } from "./application/stores/dogWalkStore";
import { useDesktopModeStore } from "./application/stores/desktopModeStore";
import { useTriageStore } from "./application/stores/triageStore";
import { useTaskStore } from "./application/stores/taskStore";
import { initNotifications, notify } from "./infrastructure/tauri/notifications";
import { connectSSE } from "./infrastructure/api/sseClient";

export function App() {
  const { fetchCalendars, fetchEvents, fetchContacts } = useCalendarStore();
  const { syncConnector, fetchTasks } = useTaskStore();
  const { currentDate, viewMode } = useViewStore();
  const { fetchConfigs, startAll, stopAll, fetchTodayLogs } = useWellnessStore();
  const { fetchTodayStats } = useTimerStore();
  const { fetchActive: fetchActiveWalk } = useDogWalkStore();
  const { isDesktopMode } = useDesktopModeStore();
  const { fetchTriage } = useTriageStore();
  let disconnectSSE: (() => void) | null = null;

  function getViewRange(): { from: Date; to: Date } {
    const d = currentDate();
    const year = d.getFullYear();
    const month = d.getMonth();

    switch (viewMode()) {
      case "triage":
      case "notes":
      case "email":
      case "settings":
      case "dashboard": {
        const from = new Date(d);
        from.setHours(0, 0, 0, 0);
        const to = new Date(d);
        to.setHours(23, 59, 59, 999);
        return { from, to };
      }
      case "month": {
        const from = new Date(year, month, 1);
        const to = new Date(year, month + 1, 0, 23, 59, 59);
        const startDay = from.getDay() === 0 ? 6 : from.getDay() - 1;
        from.setDate(from.getDate() - startDay);
        to.setDate(to.getDate() + (6 - (to.getDay() === 0 ? 6 : to.getDay() - 1)));
        return { from, to };
      }
      case "week": {
        const day = d.getDay();
        const from = new Date(d);
        from.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        from.setHours(0, 0, 0, 0);
        const to = new Date(from);
        to.setDate(from.getDate() + 6);
        to.setHours(23, 59, 59, 999);
        return { from, to };
      }
      case "day": {
        const from = new Date(d);
        from.setHours(0, 0, 0, 0);
        const to = new Date(d);
        to.setHours(23, 59, 59, 999);
        return { from, to };
      }
    }
  }

  onMount(async () => {
    await fetchCalendars();
    fetchContacts();
    syncConnector("clickup");
    fetchTasks();
    fetchTriage();
    fetchTodayStats();
    fetchActiveWalk();
    await initNotifications();
    await fetchConfigs();
    fetchTodayLogs();
    startAll();

    // Connect SSE for real-time reminder notifications
    disconnectSSE = connectSSE(async (reminder) => {
      const startTime = new Date(reminder.eventStartAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      await notify(
        reminder.eventTitle,
        reminder.minutesBefore > 0
          ? `Dans ${reminder.minutesBefore} min (${startTime})`
          : `Maintenant (${startTime})`,
      );
    });
  });

  onCleanup(() => {
    disconnectSSE?.();
    stopAll();
  });

  createEffect(() => {
    const range = getViewRange();
    fetchEvents(range.from, range.to);
  });

  return (
    <Show when={!isDesktopMode()} fallback={<DesktopWidgets />}>
      <AppLayout>
        <Show when={viewMode() === "notes"}>
          <NotesView />
        </Show>
        <Show when={viewMode() === "triage"}>
          <TriageView />
        </Show>
        <Show when={viewMode() === "email"}>
          <EmailView />
        </Show>
        <Show when={viewMode() === "settings"}>
          <SettingsView />
        </Show>
        <Show when={viewMode() !== "notes" && viewMode() !== "triage" && viewMode() !== "email" && viewMode() !== "settings"}>
          <CalendarGrid />
          <EventForm />
        </Show>
      </AppLayout>
    </Show>
  );
}
