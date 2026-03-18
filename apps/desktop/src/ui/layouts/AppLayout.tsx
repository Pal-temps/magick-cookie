import type { JSX } from "solid-js";
import { Show, For } from "solid-js";
import { useViewStore } from "../../application/stores/viewStore";
import { useCalendarStore } from "../../application/stores/calendarStore";
import { useTaskStore } from "../../application/stores/taskStore";
import { useDesktopModeStore } from "../../application/stores/desktopModeStore";
import { useSpeechStore } from "../../application/stores/speechStore";
import { useDogWalkStore } from "../../application/stores/dogWalkStore";
import { TitleBar } from "../components/common/TitleBar";
import { MiniTimer } from "../components/common/MiniTimer";
import { MiniDogWalk } from "../components/common/MiniDogWalk";
import { MiniCalendar } from "../components/sidebar/MiniCalendar";
import { CalendarList } from "../components/sidebar/CalendarList";
import { UnscheduledTasks } from "../components/sidebar/UnscheduledTasks";
import { ContactManager } from "../components/sidebar/ContactManager";
import { CollapsibleSection } from "../components/common/CollapsibleSection";
import { Button } from "../components/common/Button";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { useBookmarkStore } from "../../application/stores/bookmarkStore";
import { openUrl } from "@tauri-apps/plugin-opener";

interface AppLayoutProps {
  children: JSX.Element;
}

export function AppLayout(props: AppLayoutProps) {
  const { viewMode, setViewMode, currentDate, navigatePrev, navigateNext, goToToday } = useViewStore();
  const { openCreateForm, contacts } = useCalendarStore();
  const { syncConnector, isSyncing, tasks: unscheduledTasks } = useTaskStore();
  const { enterDesktop } = useDesktopModeStore();
  const { startSpeechRecording } = useSpeechStore();
  const { startWalk, stopWalk, activeWalk } = useDogWalkStore();
  const { favorites } = useBookmarkStore();

  const headerTitle = () => {
    const d = currentDate();
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  // --- Menu definitions ---
  const menus = () => [
    {
      label: "Fichier",
      items: [
        { label: "Nouvel evenement", shortcut: "Ctrl+N", action: openCreateForm },
        { label: "Dicter un evenement", action: () => startSpeechRecording() },
        { separator: true, label: "" },
        { label: "Sync ClickUp", action: () => syncConnector("clickup"), disabled: isSyncing() },
        { separator: true, label: "" },
        { label: "Mode bureau", action: enterDesktop },
        { separator: true, label: "" },
        { label: "Quitter", shortcut: "Alt+F4", action: () => { /* handled by window close */ } },
      ],
    },
    {
      label: "Affichage",
      items: [
        { label: "Accueil", action: () => setViewMode("dashboard"), shortcut: "Ctrl+D" },
        { separator: true, label: "" },
        { label: "Mois", action: () => setViewMode("month"), shortcut: "Ctrl+1" },
        { label: "Semaine", action: () => setViewMode("week"), shortcut: "Ctrl+2" },
        { label: "Jour", action: () => setViewMode("day"), shortcut: "Ctrl+3" },
        { separator: true, label: "" },
        { label: "Aujourd'hui", action: goToToday, shortcut: "Ctrl+T" },
        { separator: true, label: "" },
        { label: "Notes & Schemas", action: () => setViewMode("notes"), shortcut: "Ctrl+4" },
        { label: "Triage taches", action: () => setViewMode("triage"), shortcut: "Ctrl+5" },
        { label: "Email", action: () => setViewMode("email"), shortcut: "Ctrl+6" },
        { label: "Signets", action: () => setViewMode("bookmarks"), shortcut: "Ctrl+7" },
      ],
    },
    {
      label: "Outils",
      items: [
        {
          label: activeWalk() ? "Arreter la balade" : "Demarrer une balade",
          action: () => activeWalk() ? stopWalk() : startWalk(),
        },
        { separator: true, label: "" },
        { label: "Statistiques", action: () => setViewMode("dashboard") },
        { separator: true, label: "" },
        { label: "Parametres", action: () => setViewMode("settings"), shortcut: "Ctrl+," },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100vh", background: "var(--bg-base)" }}>
      {/* Title bar */}
      <TitleBar
        menus={menus()}
        rightSlot={
          <div style={{ display: "flex", "align-items": "center", gap: "4px", "margin-right": "4px" }}>
            <MiniTimer />
            <MiniDogWalk />
          </div>
        }
      />

      {/* Main layout */}
      <div style={{ display: "flex", flex: "1", overflow: "hidden" }}>
        {/* Sidebar */}
        <aside style={{
          width: "var(--sidebar-width)",
          "min-width": "var(--sidebar-width)",
          background: "var(--bg-surface)",
          "border-right": "1px solid var(--border-color)",
          display: "flex",
          "flex-direction": "column",
          overflow: "hidden",
        }}>
          {/* Top actions */}
          <div style={{ padding: "10px 12px", display: "flex", gap: "6px" }}>
            <Button variant="primary" onClick={openCreateForm} style={{ flex: "1" }} size="sm">
              + Evenement
            </Button>
          </div>

          {/* Mini calendar */}
          <MiniCalendar />

          {/* Scrollable sections */}
          <div style={{
            flex: "1",
            "overflow-y": "auto",
            "border-top": "1px solid var(--border-color)",
          }}>
            <Show when={favorites().length > 0}>
              <CollapsibleSection
                title="Favoris"
                defaultOpen={true}
                badge={
                  <span style={{ "font-size": "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 6px", "border-radius": "var(--radius-sm)" }}>
                    {favorites().length}
                  </span>
                }
              >
                <div style={{ display: "flex", "flex-direction": "column", gap: "2px" }}>
                  <For each={favorites()}>
                    {(bookmark) => (
                      <button
                        onClick={() => openUrl(bookmark.url)}
                        style={{
                          display: "flex",
                          "align-items": "center",
                          gap: "6px",
                          padding: "4px 0",
                          "font-size": "12px",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          background: "none",
                          border: "none",
                          width: "100%",
                          "text-align": "left",
                        }}
                        title={bookmark.url}
                      >
                        <span style={{ "font-size": "13px" }}>{bookmark.emoji ?? "🔗"}</span>
                        <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                          {bookmark.name}
                        </span>
                      </button>
                    )}
                  </For>
                  <button
                    onClick={() => setViewMode("bookmarks")}
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "6px",
                      padding: "4px 0",
                      "font-size": "11px",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                      width: "100%",
                      "text-align": "left",
                      "margin-top": "4px",
                    }}
                  >
                    Gerer les signets...
                  </button>
                </div>
              </CollapsibleSection>

              <div style={{ height: "1px", background: "var(--border-color)" }} />
            </Show>

            <CollapsibleSection title="Filtres" defaultOpen={true}>
              <CalendarList />
            </CollapsibleSection>

            <div style={{ height: "1px", background: "var(--border-color)" }} />

            <CollapsibleSection
              title="Contacts"
              defaultOpen={true}
              badge={
                <span style={{ "font-size": "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 6px", "border-radius": "var(--radius-sm)" }}>
                  {contacts().length}
                </span>
              }
            >
              <ContactManager />
            </CollapsibleSection>

            <div style={{ height: "1px", background: "var(--border-color)" }} />

            <CollapsibleSection
              title="Taches sans date"
              defaultOpen={false}
              badge={
                <span style={{ "font-size": "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 6px", "border-radius": "var(--radius-sm)" }}>
                  {unscheduledTasks().length}
                </span>
              }
            >
              <UnscheduledTasks />
            </CollapsibleSection>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
          {/* Navigation bar */}
          <header style={{
            height: "var(--header-height)",
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: "0 16px",
            "border-bottom": "1px solid var(--border-color)",
            "flex-shrink": "0",
          }}>
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <Button
                variant={viewMode() === "dashboard" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("dashboard")}
              >
                Accueil
              </Button>
              <Button
                variant={["month", "week", "day"].includes(viewMode()) ? "primary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("month")}
              >
                Calendrier
              </Button>
              <Button
                variant={viewMode() === "notes" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("notes")}
              >
                Notes
              </Button>
              <Button
                variant={viewMode() === "triage" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("triage")}
              >
                Triage
              </Button>
              <Button
                variant={viewMode() === "email" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("email")}
              >
                Email
              </Button>
              <Button
                variant={viewMode() === "bookmarks" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("bookmarks")}
              >
                Signets
              </Button>
              <Show when={["month", "week", "day"].includes(viewMode())}>
                <div style={{ width: "1px", height: "18px", background: "var(--border-color)", margin: "0 4px" }} />
                <Button variant="ghost" onClick={navigatePrev}>&lt;</Button>
                <h1 style={{ "font-size": "18px", "font-weight": "600", "text-transform": "capitalize", "min-width": "180px", "text-align": "center" }}>
                  {headerTitle()}
                </h1>
                <Button variant="ghost" onClick={navigateNext}>&gt;</Button>
                <Button variant="secondary" size="sm" onClick={goToToday}>Aujourd'hui</Button>
              </Show>
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              <Show when={["month", "week", "day"].includes(viewMode())}>
                <Button variant={viewMode() === "month" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("month")}>Mois</Button>
                <Button variant={viewMode() === "week" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("week")}>Semaine</Button>
                <Button variant={viewMode() === "day" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("day")}>Jour</Button>
              </Show>
            </div>
          </header>

          {/* Content */}
          <div style={{ flex: "1", overflow: "hidden" }}>
            {props.children}
          </div>
        </main>

        <TaskDetail />
      </div>
    </div>
  );
}
