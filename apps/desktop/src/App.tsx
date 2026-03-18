import { onMount, onCleanup, createEffect, Show } from "solid-js";
import { AppLayout } from "./ui/layouts/AppLayout";
import { DesktopWidgets } from "./ui/layouts/DesktopWidgets";
import { CalendarGrid } from "./ui/components/calendar/CalendarGrid";
import { EventForm } from "./ui/components/events/EventForm";
import { NotesView } from "./ui/components/notes/NotesView";
import { TriageView } from "./ui/components/triage/TriageView";
import { EmailView } from "./ui/components/email/EmailView";
import { ChatView } from "./ui/components/chat/ChatView";
import { VpsView } from "./ui/components/vps/VpsView";
import { BookmarkView } from "./ui/components/bookmarks/BookmarkView";
import { RssView } from "./ui/components/rss/RssView";
import { AlarmView } from "./ui/components/alarm/AlarmView";
import { SettingsView } from "./ui/components/settings/SettingsView";
import { useCalendarStore } from "./application/stores/calendarStore";
import { useViewStore } from "./application/stores/viewStore";
import { useWellnessStore } from "./application/stores/wellnessStore";
import { useTimerStore } from "./application/stores/timerStore";
import { useDogWalkStore } from "./application/stores/dogWalkStore";
import { useDesktopModeStore } from "./application/stores/desktopModeStore";
import { useTriageStore } from "./application/stores/triageStore";
import { useTaskStore } from "./application/stores/taskStore";
import { useCommandStore } from "./application/stores/commandStore";
import { useClipboardStore } from "./application/stores/clipboardStore";
import { useBookmarkStore } from "./application/stores/bookmarkStore";
import { useRssStore } from "./application/stores/rssStore";
import { useAlarmStore } from "./application/stores/alarmStore";
import { useProjectStore } from "./application/stores/projectStore";
import { useSmartReminderStore } from "./application/stores/smartReminderStore";
import { CommandPalette } from "./ui/components/common/CommandPalette";
import { FocusOverlay } from "./ui/components/common/FocusOverlay";
import { QuickCapture } from "./ui/components/capture/QuickCapture";
import { initNotifications, notify } from "./infrastructure/tauri/notifications";
import { connectSSE } from "./infrastructure/api/sseClient";
import { listen } from "@tauri-apps/api/event";

export function App() {
  const { fetchCalendars, fetchEvents, fetchContacts } = useCalendarStore();
  const { fetchTasks } = useTaskStore();
  const { currentDate, viewMode, setViewMode } = useViewStore();
  const { fetchConfigs, startAll, stopAll, fetchTodayLogs } = useWellnessStore();
  const { fetchTodayStats, timerState, startPomodoro, stop: stopTimer, isFocusMode, toggleFocusMode } = useTimerStore();
  const { fetchActive: fetchActiveWalk } = useDogWalkStore();
  const { isDesktopMode, toggle: toggleDesktopMode } = useDesktopModeStore();
  const { fetchTriage } = useTriageStore();
  const { open: openCommandPalette } = useCommandStore();
  const { init: initClipboard } = useClipboardStore();
  const { fetchBookmarks } = useBookmarkStore();
  const { fetchFeeds: fetchRssFeeds, fetchUnreadCount: fetchRssUnreadCount } = useRssStore();
  const { fetchProjects } = useProjectStore();
  const { startSmartReminders, stopSmartReminders } = useSmartReminderStore();
  const { fetchAlarms, startAlarmChecker, stopAlarmChecker } = useAlarmStore();
  let disconnectSSE: (() => void) | null = null;
  let unlistenShortcuts: (() => void) | null = null;

  function getViewRange(): { from: Date; to: Date } {
    const d = currentDate();
    const year = d.getFullYear();
    const month = d.getMonth();

    switch (viewMode()) {
      case "triage":
      case "notes":
      case "email":
      case "chat":
      case "vps":
      case "alarms":
      case "bookmarks":
      case "rss":
      case "settings":
      case "dashboard":
      default: {
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

  function handleGlobalKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      openCommandPalette();
    }
    if (e.key === "Escape" && isFocusMode()) {
      toggleFocusMode();
    }
  }

  onMount(async () => {
    document.addEventListener("keydown", handleGlobalKeydown);
    initClipboard();
    await fetchCalendars();
    fetchContacts();
    fetchTasks();
    fetchTriage();
    fetchTodayStats();
    fetchActiveWalk();
    fetchBookmarks();
    fetchRssFeeds();
    fetchRssUnreadCount();
    fetchAlarms().then(() => startAlarmChecker());
    fetchProjects();
    await initNotifications();
    startSmartReminders();
    await fetchConfigs();
    fetchTodayLogs();
    startAll();

    // Listen for global shortcuts (capture is handled by QuickCapture itself)
    unlistenShortcuts = await listen<string>("global-shortcut", (event) => {
      switch (event.payload) {
        case "timer":
          if (timerState() === "idle") {
            startPomodoro();
          } else {
            stopTimer();
          }
          break;
        case "brief":
          setViewMode("triage");
          break;
        case "desktop":
          toggleDesktopMode();
          break;
      }
    });

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
    document.removeEventListener("keydown", handleGlobalKeydown);
    disconnectSSE?.();
    unlistenShortcuts?.();
    stopAll();
    stopAlarmChecker();
    stopSmartReminders();
  });

  createEffect(() => {
    const range = getViewRange();
    fetchEvents(range.from, range.to);
  });

  return (
    <>
    <CommandPalette />
    <FocusOverlay />
    <QuickCapture />
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
        <Show when={viewMode() === "chat"}>
          <ChatView />
        </Show>
        <Show when={viewMode() === "vps"}>
          <VpsView />
        </Show>
        <Show when={viewMode() === "bookmarks"}>
          <BookmarkView />
        </Show>
        <Show when={viewMode() === "rss"}>
          <RssView />
        </Show>
        <Show when={viewMode() === "alarms"}>
          <AlarmView />
        </Show>
        <Show when={viewMode() === "settings"}>
          <SettingsView />
        </Show>
        <Show when={viewMode() !== "notes" && viewMode() !== "triage" && viewMode() !== "email" && viewMode() !== "chat" && viewMode() !== "vps" && viewMode() !== "bookmarks" && viewMode() !== "rss" && viewMode() !== "alarms" && viewMode() !== "settings"}>
          <CalendarGrid />
          <EventForm />
        </Show>
      </AppLayout>
    </Show>
    </>
  );
}
