import { createSignal, Show, For, type Component } from "solid-js";
import { TimerWidget } from "./TimerWidget";
import { WellnessStatus } from "./WellnessStatus";
import { DailyStats } from "./DailyStats";
import { TodayEvents } from "./TodayEvents";
import { WaterTracker } from "./WaterTracker";
import { FruitVegTracker } from "./FruitVegTracker";
import { StatsView } from "./StatsView";
import { DogWalkWidget } from "./DogWalkWidget";
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
];

const STORAGE_KEY = "magick-cookie-dashboard-order";

function loadOrder(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const ids = JSON.parse(stored) as string[];
      // Validate: keep only known IDs, append any new widgets
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
  const [order, setOrder] = createSignal<string[]>(loadOrder());
  const [draggedId, setDraggedId] = createSignal<string | null>(null);
  const [dropTargetId, setDropTargetId] = createSignal<string | null>(null);

  const orderedWidgets = () => {
    const map = new Map(ALL_WIDGETS.map((w) => [w.id, w]));
    return order().map((id) => map.get(id)!).filter(Boolean);
  };

  const today = () => {
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  function handleDragStart(e: DragEvent, id: string) {
    setDraggedId(id);
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", id);
    // Make the dragged element semi-transparent
    requestAnimationFrame(() => {
      const el = e.target as HTMLElement;
      el.style.opacity = "0.4";
    });
  }

  function handleDragEnd(e: DragEvent) {
    (e.target as HTMLElement).style.opacity = "1";
    setDraggedId(null);
    setDropTargetId(null);
  }

  function handleDragOver(e: DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    if (draggedId() && draggedId() !== id) {
      setDropTargetId(id);
    }
  }

  function handleDragLeave(_e: DragEvent, id: string) {
    if (dropTargetId() === id) setDropTargetId(null);
  }

  function handleDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    const sourceId = draggedId();
    if (!sourceId || sourceId === targetId) return;

    const current = [...order()];
    const fromIdx = current.indexOf(sourceId);
    const toIdx = current.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    current.splice(fromIdx, 1);
    current.splice(toIdx, 0, sourceId);

    setOrder(current);
    saveOrder(current);
    setDraggedId(null);
    setDropTargetId(null);
  }

  return (
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
            <Button variant="secondary" size="sm" onClick={() => setShowStats(true)}>
              Statistiques
            </Button>
          </div>

          <div class="dashboard-grid">
            <For each={orderedWidgets()}>
              {(widget) => (
                <div
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragLeave={(e) => handleDragLeave(e, widget.id)}
                  onDrop={(e) => handleDrop(e, widget.id)}
                  class="dashboard-card"
                  classList={{
                    "dashboard-card--dragging": draggedId() === widget.id,
                    "dashboard-card--drop-target": dropTargetId() === widget.id,
                  }}
                >
                  <widget.component />
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  );
}
