import { onMount, onCleanup, createEffect, Show } from "solid-js";
import { AppLayout } from "./ui/layouts/AppLayout";
import { DesktopWidgets } from "./ui/layouts/DesktopWidgets";
import { CalendarGrid } from "./ui/components/calendar/CalendarGrid";
import { EventForm } from "./ui/components/events/EventForm";
import { AiEventGenerator } from "./ui/components/calendar/AiEventGenerator";
import { NotesView } from "./ui/components/notes/NotesView";
import { IdeView } from "./ui/components/ide/IdeView";
import { FluxView } from "./ui/components/flux/FluxView";
import { EmailView } from "./ui/components/email/EmailView";
import { ChatView } from "./ui/components/chat/ChatView";
import { VpsView } from "./ui/components/vps/VpsView";
import { LibraryView } from "./ui/components/library/LibraryView";
import { RssView } from "./ui/components/rss/RssView";
import { CiCdView } from "./ui/components/github/CiCdView";
import { SettingsView } from "./ui/components/settings/SettingsView";
import { ToolsView } from "./ui/components/tools/ToolsView";
import { useCalendarStore } from "./application/stores/calendarStore";
import { useViewStore } from "./application/stores/viewStore";
import { useWellnessStore } from "./application/stores/wellnessStore";
import { useTimerStore } from "./application/stores/timerStore";
import { useDogWalkStore } from "./application/stores/dogWalkStore";
import { useDesktopModeStore } from "./application/stores/desktopModeStore";
import { useFluxStore } from "./application/stores/fluxStore";
import { useTaskStore } from "./application/stores/taskStore";
import { useCommandStore } from "./application/stores/commandStore";
import { useShortcutStore } from "./application/stores/shortcutStore";
import { useClipboardStore } from "./application/stores/clipboardStore";
import { useBookmarkStore } from "./application/stores/bookmarkStore";
import { useLlmStore } from "./application/stores/llmStore";
import { useRssStore } from "./application/stores/rssStore";
import { useSnippetStore } from "./application/stores/snippetStore";
import { useAlarmStore } from "./application/stores/alarmStore";
import { useProjectStore } from "./application/stores/projectStore";
import { useSmartReminderStore } from "./application/stores/smartReminderStore";
import { useRoutineStore } from "./application/stores/routineStore";
import { CommandPalette } from "./ui/components/common/CommandPalette";
import { FocusOverlay } from "./ui/components/common/FocusOverlay";
import { ConfirmDialog } from "./ui/components/common/ConfirmDialog";
import { AiActivityIndicator } from "./ui/components/common/AiActivityIndicator";
import { QuickCapture } from "./ui/components/capture/QuickCapture";
import { initNotifications, notify } from "./infrastructure/tauri/notifications";
import { connectSSE } from "./infrastructure/api/sseClient";
import { listen } from "@tauri-apps/api/event";
import { useOfflineQueue } from "./infrastructure/offline/offlineQueue";

export function App() {
  const { fetchCalendars, fetchEvents, fetchContacts, openCreateForm, setAlarmGetter } = useCalendarStore();
  const { fetchTasks } = useTaskStore();
  const { currentDate, viewMode, setViewMode, goToToday } = useViewStore();
  const { fetchConfigs, startAll, stopAll, fetchTodayLogs } = useWellnessStore();
  const { fetchTodayStats, timerState, startPomodoro, stop: stopTimer, isFocusMode, toggleFocusMode } = useTimerStore();
  const { fetchActive: fetchActiveWalk } = useDogWalkStore();
  const { isDesktopMode, toggle: toggleDesktopMode } = useDesktopModeStore();
  const { fetchFlux } = useFluxStore();
  const { open: openCommandPalette } = useCommandStore();
  const { matchAction } = useShortcutStore();
  const { init: initClipboard } = useClipboardStore();
  const { fetchBookmarks } = useBookmarkStore();
  const { autoSetup: autoSetupLlm } = useLlmStore();
  const { fetchFeeds: fetchRssFeeds, fetchUnreadCount: fetchRssUnreadCount } = useRssStore();
  const { fetchSnippets } = useSnippetStore();
  const { fetchProjects } = useProjectStore();
  const { startSmartReminders, stopSmartReminders } = useSmartReminderStore();
  const { alarms, fetchAlarms, startAlarmChecker, stopAlarmChecker } = useAlarmStore();
  const { fetchRoutines, startRoutineChecker, stopRoutineChecker } = useRoutineStore();
  const { startConnectivityCheck, stopConnectivityCheck } = useOfflineQueue();
  let disconnectSSE: (() => void) | null = null;
  let unlistenShortcuts: (() => void) | null = null;

  function getViewRange(): { from: Date; to: Date } {
    const d = currentDate();
    const year = d.getFullYear();
    const month = d.getMonth();

    switch (viewMode()) {
      case "flux":
      case "notes":
      case "email":
      case "chat":
      case "vps":
      case "cicd":
      case "tools":
      case "library":
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
    // Escape always exits focus mode regardless of shortcuts
    if (e.key === "Escape" && isFocusMode()) {
      toggleFocusMode();
      return;
    }

    const actionId = matchAction(e);
    if (!actionId) return;

    e.preventDefault();
    switch (actionId) {
      case "nav-dashboard": setViewMode("dashboard"); break;
      case "nav-calendar": setViewMode("month"); break;
      case "nav-ide": setViewMode("ide"); break;
      case "nav-notes": setViewMode("notes"); break;
      case "nav-flux": setViewMode("flux"); break;
      case "nav-email": setViewMode("email"); break;
      case "nav-library": setViewMode("library"); break;
      case "nav-chat": setViewMode("chat"); break;
      case "nav-vps": setViewMode("vps"); break;
      case "command-palette": openCommandPalette(); break;
      case "settings": setViewMode("settings"); break;
      case "start-pomodoro": startPomodoro(); break;
      case "stop-timer": stopTimer(); break;
      case "new-event": openCreateForm(); break;
      case "go-today": goToToday(); break;
    }
  }

  function hideSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return;
    splash.classList.add("fade-out");
    setTimeout(() => splash.remove(), 300);
  }

  onMount(async () => {
    document.addEventListener("keydown", handleGlobalKeydown);
    initClipboard();
    try {
      await fetchCalendars();
    } catch {
      // API unreachable — continue anyway, offline mode will handle it
    }
    hideSplash();
    fetchContacts();
    fetchTasks();
    fetchFlux();
    fetchTodayStats();
    fetchActiveWalk();
    fetchBookmarks();
    fetchSnippets();
    fetchRssFeeds();
    fetchRssUnreadCount();
    setAlarmGetter(alarms);
    fetchAlarms().then(() => startAlarmChecker());
    fetchRoutines().then(() => startRoutineChecker());
    fetchProjects();
    await initNotifications();
    startSmartReminders();
    autoSetupLlm();
    await fetchConfigs();
    fetchTodayLogs();
    startAll();
    startConnectivityCheck();

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
          setViewMode("flux");
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
    stopRoutineChecker();
    stopSmartReminders();
    stopConnectivityCheck();
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
    <ConfirmDialog />
    <AiActivityIndicator />
    <Show when={!isDesktopMode()} fallback={<DesktopWidgets />}>
      <AppLayout>
        <Show when={viewMode() === "notes"}>
          <NotesView />
        </Show>
        <Show when={viewMode() === "ide"}>
          <IdeView />
        </Show>
        <Show when={viewMode() === "flux"}>
          <FluxView />
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
        <Show when={viewMode() === "library"}>
          <LibraryView />
        </Show>
        <Show when={viewMode() === "rss"}>
          <RssView />
        </Show>
        <Show when={viewMode() === "cicd"}>
          <CiCdView />
        </Show>
        <Show when={viewMode() === "settings"}>
          <SettingsView />
        </Show>
        <Show when={viewMode() === "tools"}>
          <ToolsView />
        </Show>
        <Show when={viewMode() !== "notes" && viewMode() !== "ide" && viewMode() !== "flux" && viewMode() !== "email" && viewMode() !== "chat" && viewMode() !== "vps" && viewMode() !== "cicd" && viewMode() !== "library" && viewMode() !== "rss" && viewMode() !== "settings" && viewMode() !== "tools"}>
          <CalendarGrid />
          <EventForm />
          <AiEventGenerator />
        </Show>
      </AppLayout>
    </Show>
    </>
  );
}
