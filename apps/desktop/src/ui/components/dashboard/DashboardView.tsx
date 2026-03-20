import { createSignal, createEffect, on, Show, For, type Component } from "solid-js";
import { TimerWidget } from "./TimerWidget";
import { WellnessStatus } from "./WellnessStatus";
import { DailyStats } from "./DailyStats";
import { TodayEvents } from "./TodayEvents";
import { WaterTracker } from "./WaterTracker";
import { FruitVegTracker } from "./FruitVegTracker";
import { StatsView } from "./StatsView";
import { DogWalkWidget } from "./DogWalkWidget";
import { AnalyticsWidget } from "./AnalyticsWidget";
import { GitHubWidget } from "./GitHubWidget";
import { VpsWidget } from "./VpsWidget";
import { StreakWidget } from "./StreakWidget";
import { AlarmWidget } from "./AlarmWidget";
import { WeeklyReview } from "./WeeklyReview";
import { BriefView } from "./BriefView";
import { PatternsView } from "./PatternsView";
import { TimesheetView } from "./TimesheetView";
import { Button } from "../common/Button";
import { JournalButton } from "./JournalButton";
import { useDashboardStore, type WidgetId } from "../../../application/stores/dashboardStore";
import { useViewStore } from "../../../application/stores/viewStore";
import "../../styles/dashboard.css";

interface WidgetDef {
  id: WidgetId;
  label: string;
  component: Component;
}

const ALL_WIDGETS: WidgetDef[] = [
  { id: "timer", label: "Timer", component: TimerWidget },
  { id: "daily-stats", label: "Stats du jour", component: DailyStats },
  { id: "water", label: "Eau", component: WaterTracker },
  { id: "fruits", label: "Fruits & Legumes", component: FruitVegTracker },
  { id: "dog-walk", label: "Balade", component: DogWalkWidget },
  { id: "today-events", label: "Evenements", component: TodayEvents },
  { id: "wellness", label: "Bien-etre", component: WellnessStatus },
  { id: "alarms", label: "Alarmes", component: AlarmWidget },
  { id: "streak", label: "Streak", component: StreakWidget },
  { id: "github-prs", label: "GitHub PRs", component: GitHubWidget },
  { id: "vps", label: "VPS", component: VpsWidget },
  { id: "analytics", label: "Vue d'ensemble", component: AnalyticsWidget },
];

const WIDGET_MAP = new Map<WidgetId, WidgetDef>(ALL_WIDGETS.map((w) => [w.id, w]));

export function DashboardView() {
  const { widgetOrder, hiddenWidgets, reorderWidget, toggleWidget, resetLayout } = useDashboardStore();
  const { viewMode, navTick } = useViewStore();

  const [showStats, setShowStats] = createSignal(false);
  const [showWeeklyReview, setShowWeeklyReview] = createSignal(false);
  const [showBrief, setShowBrief] = createSignal(false);
  const [showPatterns, setShowPatterns] = createSignal(false);
  const [showTimesheet, setShowTimesheet] = createSignal(false);
  const [showConfig, setShowConfig] = createSignal(false);

  // Reset sub-views when navigating (even if already on dashboard)
  createEffect(on(navTick, () => {
    if (viewMode() === "dashboard") {
      setShowStats(false);
      setShowWeeklyReview(false);
      setShowBrief(false);
      setShowPatterns(false);
      setShowTimesheet(false);
    }
  }, { defer: true }));

  const [draggedId, setDraggedId] = createSignal<WidgetId | null>(null);
  const [dropTargetId, setDropTargetId] = createSignal<WidgetId | null>(null);

  // Config panel drag state (separate from grid drag)
  const [configDraggedId, setConfigDraggedId] = createSignal<WidgetId | null>(null);
  const [configDropTargetId, setConfigDropTargetId] = createSignal<WidgetId | null>(null);

  const visibleWidgets = () => {
    const hidden = hiddenWidgets();
    return widgetOrder()
      .map((id) => WIDGET_MAP.get(id))
      .filter((w): w is WidgetDef => !!w && !hidden.has(w.id));
  };

  const allOrderedWidgets = () => {
    return widgetOrder()
      .map((id) => WIDGET_MAP.get(id))
      .filter((w): w is WidgetDef => !!w);
  };

  const today = () => {
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  // ─── Pointer-based drag for grid widgets ───

  function handlePointerDown(e: PointerEvent, id: WidgetId) {
    if (e.button !== 0) return;
    e.preventDefault();

    const handle = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    handle.setPointerCapture(pointerId);

    setDraggedId(id);

    function onPointerMove(ev: PointerEvent) {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!el) { setDropTargetId(null); return; }

      const card = el.closest("[data-widget-id]") as HTMLElement | null;
      if (card && card.dataset.widgetId !== id) {
        setDropTargetId(card.dataset.widgetId as WidgetId);
      } else {
        setDropTargetId(null);
      }
    }

    function cleanup() {
      const target = dropTargetId();
      const source = draggedId();

      if (source && target && source !== target) {
        reorderWidget(source, target);
      }

      setDraggedId(null);
      setDropTargetId(null);
      try { handle.releasePointerCapture(pointerId); } catch {}
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", cleanup);
      handle.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup);
    }

    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", cleanup);
    handle.addEventListener("pointercancel", cleanup);
    window.addEventListener("blur", cleanup);
  }

  // ─── Config panel drag handlers (HTML5 drag & drop) ───

  function handleConfigDragStart(id: WidgetId) {
    setConfigDraggedId(id);
  }

  function handleConfigDragOver(e: DragEvent, id: WidgetId) {
    e.preventDefault();
    setConfigDropTargetId(id);
  }

  function handleConfigDragLeave() {
    setConfigDropTargetId(null);
  }

  function handleConfigDrop(targetId: WidgetId) {
    const from = configDraggedId();
    if (from && from !== targetId) {
      reorderWidget(from, targetId);
    }
    setConfigDraggedId(null);
    setConfigDropTargetId(null);
  }

  function handleConfigDragEnd() {
    setConfigDraggedId(null);
    setConfigDropTargetId(null);
  }

  return (
    <Show when={!showTimesheet()} fallback={<TimesheetView onClose={() => setShowTimesheet(false)} />}>
    <Show when={!showPatterns()} fallback={<PatternsView onClose={() => setShowPatterns(false)} />}>
    <Show when={!showBrief()} fallback={<BriefView onClose={() => setShowBrief(false)} />}>
    <Show when={!showWeeklyReview()} fallback={<WeeklyReview onClose={() => setShowWeeklyReview(false)} />}>
    <Show when={!showStats()} fallback={<StatsView onClose={() => setShowStats(false)} />}>
      <div class="dashboard-container" style={{ height: "100%" }}>
        <div class="dashboard-scroll">
          <div class="dashboard-header">
            <h2 style={{
              margin: "0",
              "font-size": "20px",
              "font-weight": "600",
              color: "var(--text-primary)",
              "text-transform": "capitalize",
            }}>
              {today()}
            </h2>
            <div style={{ display: "flex", gap: "6px", "align-items": "center" }}>
              <JournalButton />
              <Button variant="secondary" size="sm" onClick={() => setShowBrief(true)}>
                Brief
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowWeeklyReview(true)}>
                Bilan hebdo
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowStats(true)}>
                Statistiques
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowPatterns(true)}>
                Patterns
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowTimesheet(true)}>
                Timesheet
              </Button>
              <button
                class="dashboard-config-btn"
                onClick={() => setShowConfig(!showConfig())}
                title="Configurer le dashboard"
                classList={{ "dashboard-config-btn--active": showConfig() }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                  <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.116l.094-.318z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ─── Config Panel ─── */}
          <Show when={showConfig()}>
            <div class="dashboard-config-panel">
              <div class="dashboard-config-panel-header">
                <span style={{ "font-weight": "600", "font-size": "13px", color: "var(--text-primary)" }}>
                  Widgets
                </span>
                <button class="dashboard-config-reset" onClick={() => resetLayout()}>
                  Reset layout
                </button>
              </div>
              <div class="dashboard-config-list">
                <For each={allOrderedWidgets()}>
                  {(widget) => (
                    <div
                      class="dashboard-config-item"
                      draggable={true}
                      onDragStart={() => handleConfigDragStart(widget.id)}
                      onDragOver={(e) => handleConfigDragOver(e, widget.id)}
                      onDragLeave={handleConfigDragLeave}
                      onDrop={() => handleConfigDrop(widget.id)}
                      onDragEnd={handleConfigDragEnd}
                      classList={{
                        "dashboard-config-item--drag-over": configDropTargetId() === widget.id,
                        "dashboard-config-item--dragging": configDraggedId() === widget.id,
                      }}
                    >
                      <svg class="dashboard-config-drag-handle" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="5" cy="3" r="1.5" />
                        <circle cx="11" cy="3" r="1.5" />
                        <circle cx="5" cy="8" r="1.5" />
                        <circle cx="11" cy="8" r="1.5" />
                        <circle cx="5" cy="13" r="1.5" />
                        <circle cx="11" cy="13" r="1.5" />
                      </svg>
                      <label class="dashboard-config-label">
                        <input
                          type="checkbox"
                          checked={!hiddenWidgets().has(widget.id)}
                          onChange={() => toggleWidget(widget.id)}
                        />
                        {widget.label}
                      </label>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* ─── Widget Grid ─── */}
          <div class="dashboard-grid">
            <For each={visibleWidgets()}>
              {(widget) => (
                <div
                  data-widget-id={widget.id}
                  class="dashboard-card"
                  classList={{
                    "dashboard-card--dragging": draggedId() === widget.id,
                    "dashboard-card--drop-target": dropTargetId() === widget.id,
                  }}
                >
                  <div class="dashboard-card-header">
                    <div
                      class="dashboard-card-handle"
                      onPointerDown={(e) => handlePointerDown(e, widget.id)}
                    >
                      <svg class="dashboard-card-handle-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="5" cy="3" r="1.5" />
                        <circle cx="11" cy="3" r="1.5" />
                        <circle cx="5" cy="8" r="1.5" />
                        <circle cx="11" cy="8" r="1.5" />
                        <circle cx="5" cy="13" r="1.5" />
                        <circle cx="11" cy="13" r="1.5" />
                      </svg>
                    </div>
                    <span class="dashboard-card-title">{widget.label}</span>
                  </div>
                  <div class="dashboard-card-body">
                    <widget.component />
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
    </Show>
    </Show>
    </Show>
    </Show>
  );
}
