import { onMount, onCleanup, Show, For, createSignal } from "solid-js";
import {
  useFluxStore,
  type FluxStatus, type FluxEntityType, type FluxableItem, type FluxSuggestion,
  type FluxKanbanItem,
} from "../../../application/stores/fluxStore";
import { useTaskStore } from "../../../application/stores/taskStore";
import { useEmailStore } from "../../../application/stores/emailStore";
import { useRssStore } from "../../../application/stores/rssStore";
import { useViewStore } from "../../../application/stores/viewStore";
import { FluxSwipeCard } from "./FluxSwipeCard";
import { VirtualKanbanColumn } from "./VirtualKanbanColumn";
import { TimelineView } from "./timeline/TimelineView";
import { Button } from "../common/Button";
import "../../styles/taskjar.css";

// ─── Module-level state ───
const [activeDrag, setActiveDrag] = createSignal<{ id: string; type: FluxEntityType; name: string } | null>(null);
const [ghostPos, setGhostPos] = createSignal({ x: 0, y: 0 });
const [dropTarget, setDropTarget] = createSignal<FluxStatus | "undecided" | null>(null);

const [viewType, setViewType] = createSignal<"swipe" | "kanban" | "timeline">("kanban");
export const [emailAccountFilter, setEmailAccountFilter] = createSignal<string | "all">("all");

// ─── Kanban columns ───
const COLUMNS: { title: string; status: FluxStatus | "undecided"; color: string }[] = [
  { title: "Non trie", status: "undecided", color: "#6b7280" },
  { title: "Prioritaire", status: "priority", color: "#f87171" },
  { title: "Plus tard", status: "later", color: "#60a5fa" },
  { title: "Archive", status: "archived", color: "#a78bfa" },
];

function suggestionClass(status: string): string {
  if (status === "priority") return "taskjar-suggestion-pill taskjar-suggestion-pill--priority";
  if (status === "later") return "taskjar-suggestion-pill taskjar-suggestion-pill--later";
  return "taskjar-suggestion-pill taskjar-suggestion-pill--archived";
}

export function FluxView() {
  const flux = useFluxStore();
  const taskStore = useTaskStore();
  const emailStore = useEmailStore();
  const rssStore = useRssStore();
  const { setViewMode } = useViewStore();

  onMount(async () => {
    await flux.fetchKanban(50);
    taskStore.fetchConnectorConfigs();
  });

  // ─── Kanban columns — read from server-side data ───
  function getKanbanColumn(status: FluxStatus | "undecided") {
    return flux.kanbanColumns()[status] ?? { items: [], total: 0 };
  }

  // ─── Swipe mode ───
  function kanbanItemToFluxable(item: FluxKanbanItem): FluxableItem {
    return {
      entityType: item.entityType,
      entityId: item.entityId,
      title: item.title,
      preview: item.preview ?? "",
      source: item.source,
      timestamp: item.date ?? new Date().toISOString(),
    };
  }

  function handleStartSwipe() {
    const undecidedColumn = getKanbanColumn("undecided");
    const fluxableItems = undecidedColumn.items.map(kanbanItemToFluxable);
    flux.startFlux(fluxableItems);
  }

  function handleKeyboard(e: KeyboardEvent) {
    if (!flux.isFluxing()) return;
    switch (e.key) {
      case "ArrowRight": flux.swipe("priority"); break;
      case "ArrowLeft": flux.swipe("later"); break;
      case "ArrowUp": e.preventDefault(); flux.swipe("archived"); break;
      case "ArrowDown": e.preventDefault(); flux.swipe("dismissed"); break;
      case "z":
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); flux.undoLast(); }
        break;
    }
  }

  onMount(() => document.addEventListener("keydown", handleKeyboard));
  onCleanup(() => document.removeEventListener("keydown", handleKeyboard));

  // ─── Item open: navigate to the right page ───
  // .find() is fine here — arrays are paginated (50 items max per column, not 100K)
  function handleItemOpen(item: { entityType: FluxEntityType; entityId: string }) {
    if (item.entityType === "task") {
      const task = taskStore.tasks().find((t) => t.id === item.entityId);
      if (task) taskStore.openTaskDetail(task);
    } else if (item.entityType === "email") {
      const email = emailStore.emails().find((e) => e.id === item.entityId);
      if (email) { emailStore.selectEmail(email); setViewMode("email"); }
    } else if (item.entityType === "rss_article") {
      const article = rssStore.articles().find((a) => a.id === item.entityId);
      if (article) { rssStore.selectArticle(article); setViewMode("rss"); }
    }
  }

  // ─── Kanban drag & drop ───
  function handleCardPointerDown(item: { entityType: FluxEntityType; entityId: string; title: string }, e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) + Math.abs(dy) < 5) return;
        dragging = true;
        el.setPointerCapture(pointerId);
        setActiveDrag({ id: item.entityId, type: item.entityType, name: item.title });
      }
      setGhostPos({ x: ev.clientX, y: ev.clientY });
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const col = target?.closest("[data-flux-status]") as HTMLElement | null;
      setDropTarget(col ? (col.dataset.fluxStatus as FluxStatus | "undecided") : null);
    }

    function onUp() {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      if (dragging) {
        try { el.releasePointerCapture(pointerId); } catch {}
        const drag = activeDrag();
        const target = dropTarget();
        if (drag && target) {
          if (target === "undecided") {
            flux.undecideItem(drag.type, drag.id);
          } else {
            flux.moveItem(drag.type, drag.id, target);
          }
        }
        setActiveDrag(null);
        setDropTarget(null);
      }
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  // ─── Suggestions ───
  function handleApplySuggestion(s: FluxSuggestion) {
    flux.moveItem(s.entityType, s.entityId, s.suggestedStatus);
  }

  function handleApplyAll() {
    for (const s of flux.suggestions()) {
      flux.moveItem(s.entityType, s.entityId, s.suggestedStatus);
    }
    flux.clearSuggestions();
  }

  return (
    <div class="taskjar">
      {/* Header — minimal */}
      <div class="taskjar-header">
        <h2 class="taskjar-title">
          <span class="taskjar-title-icon">&#127850;</span> Task'Jar
        </h2>
        <div class="taskjar-actions">
          <div class="taskjar-view-modes">
            <button class={`taskjar-tab ${viewType() === "kanban" ? "taskjar-tab--active" : ""}`} onClick={() => setViewType("kanban")}>Kanban</button>
            <button class={`taskjar-tab ${viewType() === "swipe" ? "taskjar-tab--active" : ""}`} onClick={() => setViewType("swipe")}>Swipe</button>
            <button class={`taskjar-tab ${viewType() === "timeline" ? "taskjar-tab--active" : ""}`} onClick={() => setViewType("timeline")}>Timeline</button>
          </div>
        </div>
      </div>

      {/* AI Suggestions bar */}
      <Show when={flux.suggestions().length > 0}>
        <div class="taskjar-suggestions">
          <span class="taskjar-suggestions-label">
            Suggestions IA ({flux.suggestions().length})
          </span>
          <For each={flux.suggestions()}>
            {(s) => (
              <button
                class={suggestionClass(s.suggestedStatus)}
                onClick={() => handleApplySuggestion(s)}
                title={s.reason}
              >{s.entityTitle.slice(0, 25)}{s.entityTitle.length > 25 ? "..." : ""} → {s.suggestedStatus}</button>
            )}
          </For>
          <Button size="sm" variant="primary" onClick={handleApplyAll} style={{ "margin-left": "auto" }}>
            Appliquer tout
          </Button>
          <Button size="sm" variant="ghost" onClick={() => flux.clearSuggestions()}>
            Fermer
          </Button>
        </div>
      </Show>

      {/* Content */}
      <div style={{ flex: "1", overflow: "hidden" }}>
        {/* ─── Swipe Mode ─── */}
        <Show when={viewType() === "swipe"}>
          <Show when={flux.isFluxing()} fallback={
            <div class="taskjar-swipe-center">
              <p class="taskjar-swipe-start-text">
                {getKanbanColumn("undecided").total} elements a trier
              </p>
              <Button onClick={handleStartSwipe} disabled={getKanbanColumn("undecided").items.length === 0}>
                Commencer le tri
              </Button>
            </div>
          }>
            <div class="taskjar-swipe-area">
              <Show when={flux.currentItem()} fallback={
                <div style={{ "text-align": "center" }}>
                  <p class="taskjar-swipe-done-title">Tri termine !</p>
                  <p class="taskjar-swipe-done-count">
                    {flux.pendingDecisions().length} decisions en attente
                  </p>
                  <div style={{ display: "flex", gap: "8px", "justify-content": "center" }}>
                    <Button onClick={() => flux.finishFlux()}>Sauvegarder</Button>
                    <Button onClick={() => flux.stopFlux()} variant="secondary">Annuler</Button>
                  </div>
                </div>
              }>
                <FluxSwipeCard
                  item={flux.currentItem()!}
                  onSwipe={(status) => flux.swipe(status)}
                />
              </Show>

              <div class="taskjar-swipe-footer">
                <span class="taskjar-swipe-remaining">
                  {flux.remainingCount()} restant(s)
                </span>
                <Show when={flux.pendingDecisions().length > 0}>
                  <button class="taskjar-swipe-undo" onClick={() => flux.undoLast()}>
                    Annuler (Ctrl+Z)
                  </button>
                </Show>
              </div>
            </div>
          </Show>
        </Show>

        {/* ─── Kanban Mode ─── */}
        <Show when={viewType() === "kanban"}>
          <div class="taskjar-kanban">
            <For each={COLUMNS}>
              {(col) => {
                const column = () => getKanbanColumn(col.status);
                return (
                  <VirtualKanbanColumn
                    items={column().items}
                    total={column().total}
                    status={col.status}
                    color={col.color}
                    title={col.title}
                    isDropTarget={dropTarget() === col.status}
                    onItemOpen={handleItemOpen}
                    onItemPointerDown={handleCardPointerDown}
                    onLoadMore={() => flux.loadMoreColumn(col.status, column().items.length)}
                  />
                );
              }}
            </For>
          </div>
        </Show>

        {/* ─── Timeline Mode ─── */}
        <Show when={viewType() === "timeline"}>
          <TimelineView />
        </Show>
      </div>

      {/* Drag ghost */}
      <Show when={activeDrag()}>
        <div
          class="taskjar-ghost"
          style={{ left: `${ghostPos().x - 80}px`, top: `${ghostPos().y - 16}px` }}
        >
          {activeDrag()!.name}
        </div>
      </Show>
    </div>
  );
}
