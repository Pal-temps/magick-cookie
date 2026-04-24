import { onMount, onCleanup, createEffect, createSignal, Show, lazy, Suspense } from "solid-js";
import { AppLayout } from "./ui/layouts/AppLayout";
import { DesktopWidgets } from "./ui/layouts/DesktopWidgets";
import { CalendarGrid } from "./ui/components/calendar/CalendarGrid";
import { EventForm } from "./ui/components/events/EventForm";
import { AiEventGenerator } from "./ui/components/calendar/AiEventGenerator";

// Lazy-loaded views — only loaded when the user navigates to the tab
const NotesView = lazy(() => import("./ui/components/notes/NotesView").then(m => ({ default: m.NotesView })));
const IdeView = lazy(() => import("./ui/components/ide/IdeView").then(m => ({ default: m.IdeView })));
const FluxView = lazy(() => import("./ui/components/flux/FluxView").then(m => ({ default: m.FluxView })));
const EmailView = lazy(() => import("./ui/components/email/EmailView").then(m => ({ default: m.EmailView })));
const VpsView = lazy(() => import("./ui/components/vps/VpsView").then(m => ({ default: m.VpsView })));
const RssView = lazy(() => import("./ui/components/rss/RssView").then(m => ({ default: m.RssView })));
const CiCdView = lazy(() => import("./ui/components/github/CiCdView").then(m => ({ default: m.CiCdView })));
const SettingsView = lazy(() => import("./ui/components/settings/SettingsView").then(m => ({ default: m.SettingsView })));
const ToolsView = lazy(() => import("./ui/components/tools/ToolsView").then(m => ({ default: m.ToolsView })));
const PasswordsView = lazy(() => import("./ui/components/passwords/PasswordsView").then(m => ({ default: m.PasswordsView })));
const BrowserView = lazy(() => import("./ui/components/browser/BrowserView").then(m => ({ default: m.BrowserView })));
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
import { ensureVaultStructure, syncConfigsToVault } from "./application/services/vaultSyncService";
import { VaultUnlock } from "./ui/components/common/VaultUnlock";
import { connectSSE } from "./infrastructure/api/sseClient";
import { listen } from "@tauri-apps/api/event";
import { useOfflineQueue } from "./infrastructure/offline/offlineQueue";

export function App() {
  const [localeChosen, setLocaleChosen] = createSignal(!!localStorage.getItem("magick-cookie-locale"));
  const [vaultReady, setVaultReady] = createSignal(false);
  const [vaultAnimating, setVaultAnimating] = createSignal(false);

  function handleVaultUnlocked() {
    setVaultAnimating(true);
    // Wait for fly animation to finish (0.7s), then show the app
    setTimeout(() => {
      setVaultReady(true);
      setVaultAnimating(false);
    }, 750);
  }

  const { fetchCalendars, fetchEvents, fetchContacts, openCreateForm, setAlarmGetter } = useCalendarStore();
  const { fetchTasks } = useTaskStore();
  const viewStore = useViewStore();
  const { currentDate, viewMode, setViewMode, goToToday } = viewStore;
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
      case "vps":
      case "cicd":
      case "tools":
      case "rss":
      case "browser":
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
      case "nav-library": viewStore.setNotesMainTab("bookmarks"); setViewMode("notes"); break;
      case "nav-vps": setViewMode("vps"); break;
      case "nav-bench": setViewMode("notes"); break; // bench removed — use snippets
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
    // Essential data — needed for dashboard, notifications, global shortcuts
    fetchTodayStats();
    fetchActiveWalk();
    setAlarmGetter(alarms);
    fetchAlarms().then(() => startAlarmChecker());
    fetchRoutines().then(() => startRoutineChecker());
    await initNotifications();
    startSmartReminders();
    autoSetupLlm();
    fetchProjects(); // needed by dashboard TimerWidget
    // Deferred: fetchTasks, fetchFlux, fetchBookmarks, fetchSnippets,
    // fetchRssFeeds, fetchRssUnreadCount, fetchContacts
    // → loaded by their respective views on first visit

    // Vault: scaffold structure + sync configs (non-secret prefs)
    ensureVaultStructure().catch(() => {});
    try {
      const prefs = JSON.parse(localStorage.getItem("magick-cookie-preferences") ?? "{}");
      if (prefs.version) syncConfigsToVault(prefs).catch(() => {});
    } catch {}

    // Secrets: sync app secrets to backend (done after vault unlock in VaultUnlock callback)
    // The old inline sync is replaced by secretsStore.syncAppSecretsToBackend()

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
    {/* Language selection — first launch only */}
    <Show when={!localeChosen()}>
      <div class="vault-unlock-overlay">
        <div class="vault-unlock-card">
          <div class="vault-unlock-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2.5" />
              <text x="24" y="30" text-anchor="middle" fill="currentColor" font-size="18" font-weight="600">A</text>
            </svg>
          </div>
          <h2 class="vault-unlock-title">Choose your language</h2>
          <p class="vault-unlock-desc">Choisissez votre langue / Choose your language</p>
          <div style={{ display: "flex", gap: "12px", "justify-content": "center", "margin-top": "16px" }}>
            {[
              { locale: "fr" as const, flag: "🇫🇷", label: "Français" },
              { locale: "en" as const, flag: "🇬🇧", label: "English" },
            ].map((opt) => (
              <button
                class="vault-unlock-btn"
                style={{ display: "flex", "align-items": "center", gap: "8px", padding: "12px 24px" }}
                onClick={() => {
                  localStorage.setItem("magick-cookie-locale", opt.locale);
                  setLocaleChosen(true);
                  window.location.reload();
                }}
              >
                <span style={{ "font-size": "24px" }}>{opt.flag}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Show>

    {/* Vault unlock gate — animates to lock icon when unlocked */}
    <Show when={localeChosen() && !vaultReady()}>
      <VaultUnlock onUnlocked={handleVaultUnlocked} animating={vaultAnimating()} />
    </Show>

    <Show when={vaultReady()}>
    <CommandPalette />
    <FocusOverlay />
    <QuickCapture />
    <ConfirmDialog />
    <AiActivityIndicator />
    <Show when={!isDesktopMode()} fallback={<DesktopWidgets />}>
      <AppLayout>
        <Suspense fallback={<div class="view-loading" />}>
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
          <Show when={viewMode() === "vps"}>
            <VpsView />
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
          <Show when={viewMode() === "passwords"}>
            <PasswordsView />
          </Show>
          <Show when={viewMode() === "browser"}>
            <BrowserView />
          </Show>
          <Show when={viewMode() !== "notes" && viewMode() !== "ide" && viewMode() !== "flux" && viewMode() !== "email" && viewMode() !== "vps" && viewMode() !== "cicd" && viewMode() !== "rss" && viewMode() !== "settings" && viewMode() !== "tools" && viewMode() !== "passwords" && viewMode() !== "browser"}>
            <CalendarGrid />
            <EventForm />
            <AiEventGenerator />
          </Show>
        </Suspense>
      </AppLayout>
    </Show>
    </Show>
    </>
  );
}
