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

  function handleDragEnd() {
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
              {(widget) => {
                let cardRef: HTMLDivElement | undefined;

                function onHandleDragStart(e: DragEvent) {
                  // Set drag data from the handle, but drag the whole card
                  e.dataTransfer!.effectAllowed = "move";
                  e.dataTransfer!.setData("text/plain", widget.id);
                  setDraggedId(widget.id);
                  // Use the card as drag image
                  if (cardRef) {
                    e.dataTransfer!.setDragImage(cardRef, 50, 20);
                  }
                }

                return (
                  <div
                    ref={cardRef}
                    onDragOver={(e) => handleDragOver(e, widget.id)}
                    onDragLeave={(e) => handleDragLeave(e, widget.id)}
                    onDrop={(e) => handleDrop(e, widget.id)}
                    class="dashboard-card"
                    classList={{
                      "dashboard-card--dragging": draggedId() === widget.id,
                      "dashboard-card--drop-target": dropTargetId() === widget.id,
                    }}
                  >
                    <div
                      class="dashboard-card-handle"
                      draggable="true"
                      onDragStart={onHandleDragStart}
                      onDragEnd={handleDragEnd}
                    >
                      <span class="dashboard-card-handle-icon">&#8942;&#8942;</span>
                    </div>
                    <widget.component />
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>
    </Show>
  );
}
