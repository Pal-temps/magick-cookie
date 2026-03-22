import type { JSX } from "solid-js";
import { Show, For, createSignal } from "solid-js";
import { useViewStore } from "../../application/stores/viewStore";
import { useCalendarStore } from "../../application/stores/calendarStore";
import { useTaskStore } from "../../application/stores/taskStore";
import { useDesktopModeStore } from "../../application/stores/desktopModeStore";
import { useSpeechStore } from "../../application/stores/speechStore";
import { useDogWalkStore } from "../../application/stores/dogWalkStore";
import { useSettingsStore } from "../../application/stores/settingsStore";
import { TitleBar } from "../components/common/TitleBar";
import { OfflineIndicator } from "../components/common/OfflineIndicator";
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
  const { openCreateForm, contacts, setShowAiGenerator } = useCalendarStore();
  const { syncConnector, isSyncing, tasks: unscheduledTasks } = useTaskStore();
  const { enterDesktop } = useDesktopModeStore();
  const { startSpeechRecording } = useSpeechStore();
  const { startWalk, stopWalk, activeWalk } = useDogWalkStore();
  const { favorites } = useBookmarkStore();

  // Sidebar section order (persisted via settingsStore)
  const settingsStore = useSettingsStore();
  const DEFAULT_ORDER = ["favoris", "filtres", "contacts", "taches"];
  const savedOrder = (() => {
    try {
      const stored = settingsStore.getSidebar().sectionOrder;
      if (stored.length > 0) {
        const allSections = new Set(DEFAULT_ORDER);
        const valid = stored.filter((s) => allSections.has(s));
        for (const s of DEFAULT_ORDER) { if (!valid.includes(s)) valid.push(s); }
        return valid;
      }
    } catch { /* ignore */ }
    return DEFAULT_ORDER;
  })();
  const [sectionOrder, setSectionOrder] = createSignal<string[]>(savedOrder);
  const [draggedSection, setDraggedSection] = createSignal<string | null>(null);
  const [dragOverSection, setDragOverSection] = createSignal<string | null>(null);

  function handleSectionPointerDown(e: PointerEvent, id: string) {
    if (e.button !== 0) return;
    // Only initiate drag from the header zone (top 36px)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientY - rect.top > 36) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const el = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    let dragging = false;

    function onPointerMove(ev: PointerEvent) {
      // Require 5px movement to start drag (avoid interfering with click)
      if (!dragging) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) < 5) return;
        dragging = true;
        el.setPointerCapture(pointerId);
        setDraggedSection(id);
      }
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!target) { setDragOverSection(null); return; }
      const section = target.closest("[data-section-id]") as HTMLElement | null;
      if (section && section.dataset.sectionId !== id) {
        setDragOverSection(section.dataset.sectionId!);
      } else {
        setDragOverSection(null);
      }
    }

    function cleanup() {
      if (dragging) {
        const from = draggedSection();
        const target = dragOverSection();
        if (from && target && from !== target) {
          const order = [...sectionOrder()];
          const fromIdx = order.indexOf(from);
          const toIdx = order.indexOf(target);
          if (fromIdx !== -1 && toIdx !== -1) {
            order.splice(fromIdx, 1);
            order.splice(toIdx, 0, from);
            setSectionOrder(order);
            settingsStore.patchSidebar({ sectionOrder: order });
          }
        }
        setDraggedSection(null);
        setDragOverSection(null);
        try { el.releasePointerCapture(pointerId); } catch {}
      }
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", cleanup);
      el.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup);
    }

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", cleanup);
    el.addEventListener("pointercancel", cleanup);
    window.addEventListener("blur", cleanup);
  }

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
        { label: "IDE", action: () => setViewMode("ide"), shortcut: "Ctrl+4" },
        { label: "Notes & Schemas", action: () => setViewMode("notes") },
        { label: "Taches", action: () => setViewMode("triage"), shortcut: "Ctrl+5" },
        { label: "Email", action: () => setViewMode("email"), shortcut: "Ctrl+6" },
        { label: "Bibliotheque", action: () => setViewMode("library"), shortcut: "Ctrl+7" },
        { label: "Flux RSS", action: () => setViewMode("rss") },
        { label: "Chat IA", action: () => setViewMode("chat"), shortcut: "Ctrl+8" },
        { label: "CI/CD", action: () => setViewMode("cicd") },
        { label: "Serveurs", action: () => setViewMode("vps"), shortcut: "Ctrl+9" },
        { label: "Outils", action: () => setViewMode("tools") },
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
        { label: "Env & Changelog", action: () => setViewMode("tools") },
        { separator: true, label: "" },
        { label: "Parametres", action: () => setViewMode("settings"), shortcut: "Ctrl+," },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100vh", background: "var(--bg-base)" }}>
      {/* Offline indicator */}
      <OfflineIndicator />

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
            <For each={sectionOrder()}>
              {(sectionId) => {
                const sectionWrap = (content: JSX.Element) => (
                  <div
                    data-section-id={sectionId}
                    onPointerDown={(e) => {
                      // Only drag from the header area (first 36px height)
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      if (e.clientY - rect.top > 36) return;
                      handleSectionPointerDown(e, sectionId);
                    }}
                    style={{
                      "border-top": dragOverSection() === sectionId ? "2px solid var(--accent-primary)" : "2px solid transparent",
                      opacity: draggedSection() === sectionId ? "0.4" : "1",
                      transition: "opacity 0.15s",
                      "touch-action": "none",
                    }}
                  >
                    {content}
                    <div style={{ height: "1px", background: "var(--border-color)" }} />
                  </div>
                );

                if (sectionId === "favoris") {
                  return (
                    <Show when={favorites().length > 0}>
                      {sectionWrap(
                        <CollapsibleSection
                          title="Favoris"
                          defaultOpen={false}
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
                                  style={{ display: "flex", "align-items": "center", gap: "6px", padding: "4px 0", "font-size": "12px", color: "var(--text-primary)", cursor: "pointer", background: "none", border: "none", width: "100%", "text-align": "left" }}
                                  title={bookmark.url}
                                >
                                  <span style={{ "font-size": "13px" }}>{bookmark.emoji ?? "🔗"}</span>
                                  <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{bookmark.name}</span>
                                </button>
                              )}
                            </For>
                            <button
                              onClick={() => setViewMode("library")}
                              style={{ display: "flex", "align-items": "center", gap: "6px", padding: "4px 0", "font-size": "11px", color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none", width: "100%", "text-align": "left", "margin-top": "4px" }}
                            >Gerer les signets...</button>
                          </div>
                        </CollapsibleSection>
                      )}
                    </Show>
                  );
                }

                if (sectionId === "filtres") {
                  return sectionWrap(
                    <CollapsibleSection title="Filtres" defaultOpen={false}>
                      <CalendarList />
                    </CollapsibleSection>
                  );
                }

                if (sectionId === "contacts") {
                  return sectionWrap(
                    <CollapsibleSection
                      title="Contacts"
                      defaultOpen={false}
                      badge={<span style={{ "font-size": "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 6px", "border-radius": "var(--radius-sm)" }}>{contacts().length}</span>}
                    >
                      <ContactManager />
                    </CollapsibleSection>
                  );
                }

                if (sectionId === "taches") {
                  return sectionWrap(
                    <CollapsibleSection
                      title="Taches sans date"
                      defaultOpen={false}
                      badge={<span style={{ "font-size": "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 6px", "border-radius": "var(--radius-sm)" }}>{unscheduledTasks().length}</span>}
                    >
                      <UnscheduledTasks />
                    </CollapsibleSection>
                  );
                }

                return null;
              }}
            </For>
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
            <div style={{ display: "flex", "align-items": "center", gap: "4px", "min-width": "0", flex: "1", "overflow-x": "auto", "overflow-y": "hidden", "scrollbar-width": "none" }}>
              <For each={[
                { id: "dashboard", label: "Accueil", match: (v: string) => v === "dashboard" },
                { id: "month", label: "Calendrier", match: (v: string) => ["month", "week", "day"].includes(v) },
                { id: "ide", label: "IDE", match: (v: string) => v === "ide" },
                { id: "notes", label: "Notes", match: (v: string) => v === "notes" },
                { id: "triage", label: "Taches", match: (v: string) => v === "triage" },
                { id: "email", label: "Email", match: (v: string) => v === "email" },
                { id: "library", label: "Bibliotheque", match: (v: string) => v === "library" },
                { id: "rss", label: "Flux RSS", match: (v: string) => v === "rss" },
                { id: "chat", label: "Chat", match: (v: string) => v === "chat" },
                { id: "cicd", label: "CI/CD", match: (v: string) => v === "cicd" },
                { id: "vps", label: "Serveurs", match: (v: string) => v === "vps" },
                { id: "tools", label: "Outils", match: (v: string) => v === "tools" },
              ] as const}>
                {(item) => (
                  <button
                    onClick={() => setViewMode(item.id as any)}
                    style={{
                      padding: "4px 8px",
                      "border-radius": "var(--radius-sm)",
                      "font-size": "12px",
                      "white-space": "nowrap",
                      "flex-shrink": "0",
                      border: "none",
                      cursor: "pointer",
                      background: item.match(viewMode()) ? "var(--accent-color)" : "transparent",
                      color: item.match(viewMode()) ? "#fff" : "var(--text-secondary)",
                      "font-weight": item.match(viewMode()) ? "600" : "normal",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (!item.match(viewMode())) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                    onMouseLeave={(e) => { if (!item.match(viewMode())) e.currentTarget.style.background = "transparent"; }}
                  >
                    {item.label}
                  </button>
                )}
              </For>
            </div>
          </header>

          {/* Calendar sub-bar */}
          <Show when={["month", "week", "day"].includes(viewMode())}>
            <div style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              padding: "0 16px",
              height: "32px",
              "border-bottom": "1px solid var(--border-color)",
              "flex-shrink": "0",
              background: "var(--bg-surface)",
            }}>
              <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <Button variant="ghost" size="sm" onClick={navigatePrev}>&lt;</Button>
                <span style={{ "font-size": "14px", "font-weight": "600", "text-transform": "capitalize", "min-width": "160px", "text-align": "center" }}>
                  {headerTitle()}
                </span>
                <Button variant="ghost" size="sm" onClick={navigateNext}>&gt;</Button>
                <Button variant="secondary" size="sm" onClick={goToToday}>Aujourd'hui</Button>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <Button variant="ghost" size="sm" onClick={() => setShowAiGenerator(true)} title="Generer des evenements avec l'IA">IA</Button>
                <Button variant={viewMode() === "month" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("month")}>Mois</Button>
                <Button variant={viewMode() === "week" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("week")}>Semaine</Button>
                <Button variant={viewMode() === "day" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("day")}>Jour</Button>
              </div>
            </div>
          </Show>

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
