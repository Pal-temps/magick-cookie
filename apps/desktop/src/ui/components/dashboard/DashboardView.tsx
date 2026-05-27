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
import { SetupChecklist } from "./SetupChecklist";
import { useDashboardStore, type WidgetId } from "../../../application/stores/dashboardStore";
import { useViewStore } from "../../../application/stores/viewStore";
import { useT } from "../../../i18n/context";
import "../../styles/dashboard.css";

interface WidgetDef {
  id: WidgetId;
  labelKey: string;
  component: Component;
}

const ALL_WIDGETS: WidgetDef[] = [
  { id: "timer", labelKey: "dashboard.timer", component: TimerWidget },
  { id: "daily-stats", labelKey: "dashboard.dailyStats", component: DailyStats },
  { id: "water", labelKey: "dashboard.water", component: WaterTracker },
  { id: "fruits", labelKey: "dashboard.fruitsVeg", component: FruitVegTracker },
  { id: "dog-walk", labelKey: "dashboard.walk", component: DogWalkWidget },
  { id: "today-events", labelKey: "dashboard.events", component: TodayEvents },
  { id: "wellness", labelKey: "dashboard.wellness", component: WellnessStatus },
  { id: "alarms", labelKey: "dashboard.alarm", component: AlarmWidget },
  { id: "streak", labelKey: "dashboard.streak", component: StreakWidget },
  { id: "github-prs", labelKey: "dashboard.githubPrs", component: GitHubWidget },
  { id: "vps", labelKey: "dashboard.vps", component: VpsWidget },
  { id: "analytics", labelKey: "dashboard.overview", component: AnalyticsWidget },
];

const WIDGET_MAP = new Map<WidgetId, WidgetDef>(ALL_WIDGETS.map((w) => [w.id, w]));

export function DashboardView() {
  const { widgetOrder, hiddenWidgets, reorderWidget, toggleWidget, resetLayout, pinWidget, unpinWidget, isPinned } = useDashboardStore();
  const { viewMode, navTick } = useViewStore();
  const { t, locale } = useT();

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
      .filter((w): w is WidgetDef => !!w && !hidden.has(w.id) && !isPinned(w.id));
  };

  const allOrderedWidgets = () => {
    return widgetOrder()
      .map((id) => WIDGET_MAP.get(id))
      .filter((w): w is WidgetDef => !!w);
  };

  const today = () => {
    const d = new Date();
    return d.toLocaleDateString(locale() === "fr" ? "fr-FR" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
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
            <h2 class="dashboard-date-heading">
              {today()}
            </h2>
            <div class="dashboard-header-actions">
              <JournalButton />
              <Button variant="secondary" size="sm" onClick={() => setShowBrief(true)}>
                {t("dashboard.brief")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowWeeklyReview(true)}>
                {t("dashboard.weeklyReview")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowStats(true)}>
                {t("dashboard.stats")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowPatterns(true)}>
                {t("dashboard.patterns")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowTimesheet(true)}>
                {t("dashboard.timesheet")}
              </Button>
            </div>
            <button
              class="dashboard-config-btn"
              onClick={() => setShowConfig(!showConfig())}
              title={t("dashboard.configDashboard")}
              classList={{ "dashboard-config-btn--active": showConfig() }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.116l.094-.318z"/>
              </svg>
            </button>
          </div>

          {/* ─── Config Panel ─── */}
          <Show when={showConfig()}>
            <div class="dashboard-config-panel">
              <div class="dashboard-config-panel-header">
                <span style={{ "font-weight": "600", "font-size": "13px", color: "var(--text-primary)" }}>
                  {t("dashboard.widgets")}
                </span>
                <button class="dashboard-config-reset" onClick={() => resetLayout()}>
                  {t("dashboard.resetLayout")}
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
                        {t(widget.labelKey)}
                      </label>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* ─── Setup Checklist ─── */}
          <SetupChecklist />

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
                    <span class="dashboard-card-title">{t(widget.labelKey)}</span>
                    <button
                      class="dashboard-card-pin"
                      classList={{ "dashboard-card-pin--active": isPinned(widget.id) }}
                      onClick={() => isPinned(widget.id) ? unpinWidget(widget.id) : pinWidget(widget.id)}
                      title={isPinned(widget.id) ? t("dashboard.unpinFromSidebar") : t("dashboard.pinToSidebar")}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z"/>
                      </svg>
                    </button>
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
