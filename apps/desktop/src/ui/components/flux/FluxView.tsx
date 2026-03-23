import { onMount, onCleanup, Show, For, createMemo, createSignal } from "solid-js";
import {
  useFluxStore,
  taskToFluxable, emailToFluxable, articleToFluxable,
  type FluxStatus, type FluxEntityType, type FluxableItem, type FluxSuggestion,
} from "../../../application/stores/fluxStore";
import { useTaskStore } from "../../../application/stores/taskStore";
import { useEmailStore } from "../../../application/stores/emailStore";
import { useRssStore } from "../../../application/stores/rssStore";
import { FluxSwipeCard } from "./FluxSwipeCard";
import { Button } from "../common/Button";
import { AiButton } from "../common/AiButton";

// ─── Module-level drag state ───
const [activeDrag, setActiveDrag] = createSignal<{ id: string; type: FluxEntityType; name: string } | null>(null);
const [ghostPos, setGhostPos] = createSignal({ x: 0, y: 0 });
const [dropTarget, setDropTarget] = createSignal<FluxStatus | "undecided" | null>(null);

const [viewType, setViewType] = createSignal<"swipe" | "kanban">("kanban");

// ─── Entity type tabs ───
const ENTITY_TABS: { key: FluxEntityType | "all"; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "task", label: "Taches" },
  { key: "email", label: "Emails" },
  { key: "rss_article", label: "Articles" },
];

// ─── Kanban columns ───
const COLUMNS: { title: string; status: FluxStatus | "undecided"; color: string }[] = [
  { title: "Non trie", status: "undecided", color: "#6b7280" },
  { title: "Prioritaire", status: "priority", color: "#ef4444" },
  { title: "Plus tard", status: "later", color: "#3b82f6" },
  { title: "Archive", status: "archived", color: "#8b5cf6" },
];

export function FluxView() {
  const flux = useFluxStore();
  const taskStore = useTaskStore();
  const emailStore = useEmailStore();
  const rssStore = useRssStore();

  onMount(async () => {
    await flux.fetchFlux();
    // Load data from all sources
    if (taskStore.tasks().length === 0) await taskStore.fetchUnscheduledTasks();
    if (emailStore.emails().length === 0) await emailStore.fetchEmails();
    if (rssStore.articles().length === 0) await rssStore.fetchArticles();
  });

  // ─── All items merged ───
  const allItems = createMemo((): FluxableItem[] => {
    const items: FluxableItem[] = [];

    // Tasks
    for (const t of taskStore.tasks()) {
      items.push(taskToFluxable(t));
    }

    // Emails — only unread + not archived from INBOX
    for (const e of emailStore.emails()) {
      if (!e.isArchived && !e.isRead) {
        items.push(emailToFluxable(e));
      }
    }

    // RSS articles — only unread
    const feeds = rssStore.feeds();
    for (const a of rssStore.articles()) {
      if (!a.isRead) {
        const feed = feeds.find((f) => f.id === a.feedId);
        items.push(articleToFluxable(a, feed?.label));
      }
    }

    return items;
  });

  // ─── Filtered by active entity type ───
  const filteredItems = createMemo(() => {
    const type = flux.activeEntityType();
    if (type === "all") return allItems();
    return allItems().filter((i) => i.entityType === type);
  });

  // ─── Kanban columns ───
  const undecidedItems = createMemo(() => flux.getUndecidedItems(filteredItems()));
  const priorityItems = createMemo(() => flux.getItemsByStatus("priority", filteredItems()));
  const laterItems = createMemo(() => flux.getItemsByStatus("later", filteredItems()));
  const archivedItems = createMemo(() => flux.getItemsByStatus("archived", filteredItems()));

  function getColumnItems(status: FluxStatus | "undecided"): FluxableItem[] {
    switch (status) {
      case "undecided": return undecidedItems();
      case "priority": return priorityItems();
      case "later": return laterItems();
      case "archived": return archivedItems();
      default: return [];
    }
  }

  // ─── Swipe mode ───
  function handleStartSwipe() {
    flux.startFlux(filteredItems());
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

  // ─── Kanban drag & drop ───
  function handleDragStart(item: FluxableItem, e: PointerEvent) {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setActiveDrag({ id: item.entityId, type: item.entityType, name: item.title });
    setGhostPos({ x: e.clientX, y: e.clientY });
  }

  function handleDragMove(e: PointerEvent) {
    if (!activeDrag()) return;
    setGhostPos({ x: e.clientX, y: e.clientY });
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const col = el?.closest("[data-flux-status]") as HTMLElement | null;
    setDropTarget(col ? (col.dataset.fluxStatus as FluxStatus | "undecided") : null);
  }

  function handleDragEnd() {
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
    <div
      style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }}
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
    >
      {/* Header */}
      <div style={{
        display: "flex", "align-items": "center", gap: "8px",
        padding: "12px 16px", "border-bottom": "1px solid var(--border-color)",
        "flex-shrink": "0",
      }}>
        <h2 style={{ "font-size": "16px", "font-weight": "600", color: "var(--text-primary)", margin: "0" }}>
          Flux
        </h2>

        {/* Entity type tabs */}
        <div style={{ display: "flex", gap: "2px", "margin-left": "16px" }}>
          <For each={ENTITY_TABS}>
            {(tab) => (
              <button
                onClick={() => flux.setActiveEntityType(tab.key)}
                style={{
                  padding: "4px 10px", "font-size": "11px",
                  background: flux.activeEntityType() === tab.key ? "var(--accent-primary)" : "var(--bg-elevated)",
                  color: flux.activeEntityType() === tab.key ? "#fff" : "var(--text-secondary)",
                  border: "none", "border-radius": "var(--radius-sm)", cursor: "pointer",
                }}
              >{tab.label}</button>
            )}
          </For>
        </div>

        <div style={{ "margin-left": "auto", display: "flex", gap: "6px", "align-items": "center" }}>
          {/* View toggle */}
          <button
            onClick={() => setViewType((v) => v === "kanban" ? "swipe" : "kanban")}
            style={{
              padding: "4px 10px", "font-size": "11px",
              background: "var(--bg-elevated)", border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-sm)", color: "var(--text-secondary)", cursor: "pointer",
            }}
          >{viewType() === "kanban" ? "Mode Swipe" : "Mode Kanban"}</button>

          {/* AI suggest */}
          <AiButton
            onClick={() => flux.fetchSuggestions(flux.activeEntityType() === "all" ? undefined : flux.activeEntityType() as FluxEntityType)}
            disabled={flux.suggestLoading()}
            size="sm"
          >{flux.suggestLoading() ? "..." : "IA Tri"}</AiButton>
        </div>
      </div>

      {/* AI Suggestions bar */}
      <Show when={flux.suggestions().length > 0}>
        <div style={{
          padding: "8px 16px", background: "var(--bg-elevated)",
          "border-bottom": "1px solid var(--border-color)", "flex-shrink": "0",
          display: "flex", "align-items": "center", gap: "8px", "flex-wrap": "wrap",
        }}>
          <span style={{ "font-size": "12px", "font-weight": "600", color: "var(--text-primary)" }}>
            Suggestions IA ({flux.suggestions().length})
          </span>
          <For each={flux.suggestions()}>
            {(s) => (
              <button
                onClick={() => handleApplySuggestion(s)}
                style={{
                  padding: "3px 8px", "font-size": "10px", "border-radius": "var(--radius-sm)",
                  background: s.suggestedStatus === "priority" ? "#ef444420" : s.suggestedStatus === "later" ? "#3b82f620" : "#8b5cf620",
                  color: s.suggestedStatus === "priority" ? "#ef4444" : s.suggestedStatus === "later" ? "#3b82f6" : "#8b5cf6",
                  border: "none", cursor: "pointer",
                }}
                title={s.reason}
              >{s.entityTitle.slice(0, 25)}{s.entityTitle.length > 25 ? "..." : ""} → {s.suggestedStatus}</button>
            )}
          </For>
          <button
            onClick={handleApplyAll}
            style={{
              padding: "3px 8px", "font-size": "10px", background: "var(--accent-primary)",
              color: "#fff", border: "none", "border-radius": "var(--radius-sm)", cursor: "pointer",
              "margin-left": "auto",
            }}
          >Appliquer tout</button>
          <button
            onClick={() => flux.clearSuggestions()}
            style={{
              padding: "3px 8px", "font-size": "10px", background: "var(--bg-surface)",
              color: "var(--text-muted)", border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-sm)", cursor: "pointer",
            }}
          >Fermer</button>
        </div>
      </Show>

      {/* Content */}
      <div style={{ flex: "1", overflow: "hidden" }}>
        {/* ─── Swipe Mode ─── */}
        <Show when={viewType() === "swipe"}>
          <Show when={flux.isFluxing()} fallback={
            <div style={{ height: "100%", display: "flex", "align-items": "center", "justify-content": "center", "flex-direction": "column", gap: "16px" }}>
              <p style={{ "font-size": "14px", color: "var(--text-secondary)" }}>
                {undecidedItems().length} elements a trier
              </p>
              <Button onClick={handleStartSwipe} disabled={undecidedItems().length === 0}>
                Commencer le tri
              </Button>
            </div>
          }>
            <div style={{ height: "100%", display: "flex", "align-items": "center", "justify-content": "center", position: "relative" }}>
              <Show when={flux.currentItem()} fallback={
                <div style={{ "text-align": "center" }}>
                  <p style={{ "font-size": "16px", "font-weight": "600", color: "var(--text-primary)", "margin-bottom": "12px" }}>
                    Tri termine !
                  </p>
                  <p style={{ "font-size": "13px", color: "var(--text-secondary)", "margin-bottom": "16px" }}>
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

              {/* Counter + undo */}
              <div style={{
                position: "absolute", bottom: "20px", left: "0", right: "0",
                display: "flex", "justify-content": "center", gap: "12px", "align-items": "center",
              }}>
                <span style={{ "font-size": "12px", color: "var(--text-muted)" }}>
                  {flux.remainingCount()} restant(s)
                </span>
                <Show when={flux.pendingDecisions().length > 0}>
                  <button
                    onClick={() => flux.undoLast()}
                    style={{
                      padding: "4px 10px", "font-size": "11px", background: "var(--bg-elevated)",
                      border: "1px solid var(--border-color)", "border-radius": "var(--radius-sm)",
                      color: "var(--text-secondary)", cursor: "pointer",
                    }}
                  >Annuler (Ctrl+Z)</button>
                </Show>
              </div>
            </div>
          </Show>
        </Show>

        {/* ─── Kanban Mode ─── */}
        <Show when={viewType() === "kanban"}>
          <div style={{
            display: "grid", "grid-template-columns": "repeat(4, 1fr)", gap: "12px",
            padding: "12px 16px", height: "100%", overflow: "hidden",
          }}>
            <For each={COLUMNS}>
              {(col) => {
                const items = () => getColumnItems(col.status);
                return (
                  <div
                    data-flux-status={col.status}
                    style={{
                      display: "flex", "flex-direction": "column", "border-radius": "8px",
                      background: dropTarget() === col.status ? `${col.color}10` : "transparent",
                      border: dropTarget() === col.status ? `2px dashed ${col.color}` : "2px solid transparent",
                      transition: "background 0.15s, border 0.15s",
                      overflow: "hidden",
                    }}
                  >
                    {/* Column header */}
                    <div style={{
                      padding: "8px 10px", display: "flex", "align-items": "center", gap: "6px",
                      "border-bottom": `2px solid ${col.color}`, "flex-shrink": "0",
                    }}>
                      <span style={{ "font-size": "12px", "font-weight": "600", color: col.color }}>
                        {col.title}
                      </span>
                      <span style={{
                        "font-size": "10px", "font-weight": "600", padding: "1px 6px",
                        "border-radius": "8px", background: `${col.color}20`, color: col.color,
                        "margin-left": "auto",
                      }}>
                        {items().length}
                      </span>
                    </div>

                    {/* Column items */}
                    <div style={{ flex: "1", "overflow-y": "auto", padding: "6px" }}>
                      <For each={items()}>
                        {(item) => (
                          <div
                            onPointerDown={(e) => handleDragStart(item, e)}
                            style={{
                              padding: "8px 10px", "margin-bottom": "6px",
                              background: "var(--bg-surface)", border: "1px solid var(--border-color)",
                              "border-radius": "6px", cursor: "grab", "user-select": "none",
                              "touch-action": "none",
                            }}
                          >
                            <div style={{ display: "flex", "align-items": "center", gap: "4px", "margin-bottom": "4px" }}>
                              <span style={{
                                "font-size": "8px", "font-weight": "700", padding: "1px 4px",
                                "border-radius": "2px",
                                background: item.entityType === "task" ? "var(--accent-primary)" : item.entityType === "email" ? "#0984e3" : "#00b894",
                                color: "#fff",
                              }}>
                                {item.entityType === "task" ? "T" : item.entityType === "email" ? "@" : "R"}
                              </span>
                              <span style={{ "font-size": "10px", color: "var(--text-muted)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                                {item.source}
                              </span>
                            </div>
                            <div style={{ "font-size": "12px", "font-weight": "500", color: "var(--text-primary)", "line-height": "1.3" }}>
                              {item.title.length > 60 ? item.title.slice(0, 60) + "..." : item.title}
                            </div>
                          </div>
                        )}
                      </For>
                      <Show when={items().length === 0}>
                        <div style={{ padding: "20px 8px", "text-align": "center", "font-size": "11px", color: "var(--text-muted)" }}>
                          Vide
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Drag ghost */}
      <Show when={activeDrag()}>
        <div style={{
          position: "fixed", left: `${ghostPos().x - 80}px`, top: `${ghostPos().y - 16}px`,
          "z-index": "1000", padding: "6px 12px", background: "var(--bg-surface)",
          border: "1px solid var(--accent-primary)", "border-radius": "6px",
          "font-size": "12px", color: "var(--text-primary)", "pointer-events": "none",
          "box-shadow": "0 4px 16px rgba(0,0,0,0.2)", "max-width": "200px",
          overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap",
        }}>
          {activeDrag()!.name}
        </div>
      </Show>
    </div>
  );
}
