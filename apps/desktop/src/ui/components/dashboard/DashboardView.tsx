import { createSignal, Show, For, type Component } from "solid-js";
import { TimerWidget } from "./TimerWidget";
import { WellnessStatus } from "./WellnessStatus";
import { DailyStats } from "./DailyStats";
import { TodayEvents } from "./TodayEvents";
import { WaterTracker } from "./WaterTracker";
import { FruitVegTracker } from "./FruitVegTracker";
import { StatsView } from "./StatsView";
import { DogWalkWidget } from "./DogWalkWidget";
import { AnalyticsWidget } from "./AnalyticsWidget";
import { WeeklyReview } from "./WeeklyReview";
import { Button } from "../common/Button";
import "../../styles/dashboard.css";

interface WidgetDef {
  id: string;
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
  { id: "analytics", label: "Vue d'ensemble", component: AnalyticsWidget },
];

const STORAGE_KEY = "magick-cookie-dashboard-order";

function loadOrder(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const ids = JSON.parse(stored) as string[];
      const known = new Set(ALL_WIDGETS.map((w) => w.id));
      const valid = ids.filter((id) => known.has(id));
      const missing = ALL_WIDGETS.map((w) => w.id).filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    }
  } catch {}
  return ALL_WIDGETS.map((w) => w.id);
}

function saveOrder(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function DashboardView() {
  const [showStats, setShowStats] = createSignal(false);
  const [showWeeklyReview, setShowWeeklyReview] = createSignal(false);
  const [order, setOrder] = createSignal<string[]>(loadOrder());
  const [draggedId, setDraggedId] = createSignal<string | null>(null);
  const [dropTargetId, setDropTargetId] = createSignal<string | null>(null);

  // Refs for each card by widget id
  const cardRefs = new Map<string, HTMLDivElement>();

  const orderedWidgets = () => {
    const map = new Map(ALL_WIDGETS.map((w) => [w.id, w]));
    return order().map((id) => map.get(id)!).filter(Boolean);
  };

  const today = () => {
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  // ─── Pointer-based drag ───

  function handlePointerDown(e: PointerEvent, id: string) {
    // Only left mouse button
    if (e.button !== 0) return;
    e.preventDefault();

    const handle = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    handle.setPointerCapture(pointerId);

    setDraggedId(id);

    function onPointerMove(ev: PointerEvent) {
      // Find which card we're hovering over
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!el) { setDropTargetId(null); return; }

      const card = el.closest("[data-widget-id]") as HTMLElement | null;
      if (card && card.dataset.widgetId !== id) {
        setDropTargetId(card.dataset.widgetId!);
      } else {
        setDropTargetId(null);
      }
    }

    function cleanup() {
      const target = dropTargetId();
      const source = draggedId();

      if (source && target && source !== target) {
        const current = [...order()];
        const fromIdx = current.indexOf(source);
        const toIdx = current.indexOf(target);
        if (fromIdx !== -1 && toIdx !== -1) {
          current.splice(fromIdx, 1);
          current.splice(toIdx, 0, source);
          setOrder(current);
          saveOrder(current);
        }
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

  return (
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
            <div style={{ display: "flex", gap: "6px" }}>
              <Button variant="secondary" size="sm" onClick={() => setShowWeeklyReview(true)}>
                Bilan hebdo
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowStats(true)}>
                Statistiques
              </Button>
            </div>
          </div>

          <div class="dashboard-grid">
            <For each={orderedWidgets()}>
              {(widget) => (
                <div
                  ref={(el) => cardRefs.set(widget.id, el)}
                  data-widget-id={widget.id}
                  class="dashboard-card"
                  classList={{
                    "dashboard-card--dragging": draggedId() === widget.id,
                    "dashboard-card--drop-target": dropTargetId() === widget.id,
                  }}
                >
                  <div
                    class="dashboard-card-handle"
                    onPointerDown={(e) => handlePointerDown(e, widget.id)}
                  >
                    <span class="dashboard-card-handle-icon">&#8942;&#8942;</span>
                  </div>
                  <widget.component />
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
    </Show>
  );
}
