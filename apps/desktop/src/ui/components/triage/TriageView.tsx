import { onMount, Show, For, createMemo, createSignal } from "solid-js";
import { useTriageStore, type TriageStatus, type TriageSuggestion } from "../../../application/stores/triageStore";
import { useTaskStore } from "../../../application/stores/taskStore";
import type { Task } from "../../../domain/models/Task";
import { SwipeCard } from "./SwipeCard";
import { Button } from "../common/Button";

// --- Module-level drag state (ephemeral, no persistence needed) ---
const [activeDrag, setActiveDrag] = createSignal<{ id: string; name: string } | null>(null);
const [ghostPos, setGhostPos] = createSignal({ x: 0, y: 0 });
const [dropTarget, setDropTarget] = createSignal<TriageStatus | null>(null);

export function TriageView() {
  const triage = useTriageStore();
  const { tasks: unscheduledTasks, fetchUnscheduledTasks, syncConnector, isSyncing, openTaskDetail } = useTaskStore();

  onMount(async () => {
    await triage.fetchTriage();
    if (unscheduledTasks().length === 0) {
      await fetchUnscheduledTasks();
    }
  });

  const priorityTasks = createMemo(() => triage.getTasksByStatus("priority", unscheduledTasks()));
  const laterTasks = createMemo(() => triage.getTasksByStatus("later", unscheduledTasks()));
  const archivedTasks = createMemo(() => triage.getTasksByStatus("archived", unscheduledTasks()));
  const untriagedTasks = createMemo(() => triage.getUntriagedTasks(unscheduledTasks()));

  function handleStartTriage() {
    triage.startTriage(unscheduledTasks());
  }

  async function handleFinish() {
    await triage.finishTriage();
  }

  function handleKeyboard(e: KeyboardEvent) {
    if (!triage.isTriaging()) return;
    switch (e.key) {
      case "ArrowRight": triage.swipe("priority"); break;
      case "ArrowLeft": triage.swipe("later"); break;
      case "ArrowUp": e.preventDefault(); triage.swipe("archived"); break;
      case "ArrowDown": e.preventDefault(); triage.swipe("dismissed"); break;
      case "z": if (e.ctrlKey) triage.undoLast(); break;
    }
  }

  return (
    <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }} tabIndex={0} onKeyDown={handleKeyboard}>
      <Show when={triage.isTriaging()} fallback={<TriageDashboard
        priorityTasks={priorityTasks()}
        laterTasks={laterTasks()}
        archivedTasks={archivedTasks()}
        untriagedTasks={untriagedTasks()}
        totalCount={unscheduledTasks().length}
        onStartTriage={handleStartTriage}
        onSync={() => syncConnector("clickup")}
        isSyncing={isSyncing()}
        onClickTask={openTaskDetail}
        onMoveTask={(id, status) => triage.moveTask(id, status)}
      />}>
        <div style={{
          flex: "1",
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          "justify-content": "center",
          position: "relative",
        }}>
          {/* Header */}
          <div style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            right: "16px",
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
          }}>
            <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
              <Button size="sm" variant="ghost" onClick={() => triage.stopTriage()}>
                &#8592; Retour
              </Button>
              <span style={{ "font-size": "13px", color: "var(--text-secondary)" }}>
                {triage.remainingCount()} tache(s) restante(s)
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button size="sm" variant="ghost" onClick={() => triage.undoLast()} disabled={triage.pendingDecisions().length === 0}>
                Annuler (Ctrl+Z)
              </Button>
              <Button size="sm" variant="primary" onClick={handleFinish} disabled={triage.isSaving()}>
                {triage.isSaving() ? "..." : `Terminer (${triage.pendingDecisions().length})`}
              </Button>
            </div>
          </div>

          {/* Card area */}
          <Show when={triage.currentTask()} fallback={
            <div style={{ "text-align": "center" }}>
              <div style={{ "font-size": "48px", "margin-bottom": "16px" }}>&#10003;</div>
              <h2 style={{ "font-size": "20px", "font-weight": "600", color: "var(--text-primary)", "margin-bottom": "8px" }}>
                Triage termine !
              </h2>
              <p style={{ "font-size": "13px", color: "var(--text-muted)", "margin-bottom": "20px" }}>
                {triage.pendingDecisions().length} decision(s) a sauvegarder
              </p>
              <div style={{ display: "flex", gap: "8px", "justify-content": "center" }}>
                <Button variant="primary" onClick={handleFinish} disabled={triage.isSaving()}>
                  {triage.isSaving() ? "Sauvegarde..." : "Sauvegarder et quitter"}
                </Button>
                <Button variant="ghost" onClick={() => triage.stopTriage()}>
                  Annuler
                </Button>
              </div>
            </div>
          }>
            <SwipeCard
              task={triage.currentTask()!}
              onSwipe={(status) => triage.swipe(status)}
            />
          </Show>

          {/* Direction hints */}
          <Show when={triage.currentTask()}>
            <div style={{
              position: "absolute",
              bottom: "24px",
              "font-size": "11px",
              color: "var(--text-muted)",
              "text-align": "center",
            }}>
              Glissez la carte ou utilisez les fleches du clavier
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// --- Dashboard ---

interface TriageDashboardProps {
  priorityTasks: Task[];
  laterTasks: Task[];
  archivedTasks: Task[];
  untriagedTasks: Task[];
  totalCount: number;
  onStartTriage: () => void;
  onSync: () => void;
  isSyncing: boolean;
  onClickTask: (task: Task) => void;
  onMoveTask: (taskId: string, newStatus: TriageStatus) => void;
}

function TriageDashboard(props: TriageDashboardProps) {
  const triage = useTriageStore();

  async function handleAutoTriage() {
    await triage.fetchSuggestions();
  }

  async function applySuggestion(suggestion: TriageSuggestion) {
    await triage.moveTask(suggestion.taskId, suggestion.suggestedStatus);
    // Remove from suggestions list
    triage.clearSuggestions();
    // Re-fetch to update (without the applied one)
  }

  async function applyAllSuggestions() {
    const items = triage.suggestions().map(s => ({
      taskId: s.taskId,
      triageStatus: s.suggestedStatus as TriageStatus,
    }));
    for (const item of items) {
      await triage.moveTask(item.taskId, item.triageStatus);
    }
    triage.clearSuggestions();
  }

  const statusColors: Record<string, string> = {
    priority: "#ef4444",
    later: "#3b82f6",
    archived: "#8b5cf6",
  };

  const statusLabels: Record<string, string> = {
    priority: "Prioritaire",
    later: "Plus tard",
    archived: "Archive",
  };

  return (
    <div style={{ height: "100%", "overflow-y": "auto", padding: "20px", position: "relative" }}>
      {/* Drag ghost */}
      <Show when={activeDrag()}>
        <div
          id="triage-ghost"
          style={{
            position: "fixed",
            left: ghostPos().x + "px",
            top: ghostPos().y + "px",
            transform: "translate(-50%, -50%) rotate(2deg)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-color)",
            "border-radius": "var(--radius-sm)",
            padding: "6px 12px",
            "font-size": "12px",
            color: "var(--text-primary)",
            "pointer-events": "none",
            "z-index": "9999",
            "box-shadow": "0 4px 16px rgba(0,0,0,0.3)",
            "max-width": "200px",
            "white-space": "nowrap",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            opacity: "0.95",
          }}
        >
          {activeDrag()!.name}
        </div>
      </Show>

      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <div>
          <h2 style={{ "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>Triage des taches</h2>
          <p style={{ "font-size": "12px", color: "var(--text-muted)", "margin-top": "4px" }}>
            {props.totalCount} tache(s) au total — {props.untriagedTasks.length} non triee(s)
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button size="sm" variant="secondary" onClick={handleAutoTriage} disabled={triage.suggestLoading()}>
            {triage.suggestLoading() ? "Analyse en cours..." : "Auto-triage (IA)"}
          </Button>
          <Button size="sm" variant="secondary" onClick={props.onSync} disabled={props.isSyncing}>
            {props.isSyncing ? "..." : "Sync ClickUp"}
          </Button>
        </div>
      </div>

      {/* Suggestions panel */}
      <Show when={triage.suggestLoading()}>
        <div style={{
          background: "var(--bg-elevated)",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--border-color)",
          padding: "20px",
          "margin-bottom": "20px",
          "text-align": "center",
        }}>
          <div style={{ "font-size": "14px", color: "var(--text-secondary)", "margin-bottom": "4px" }}>
            L'IA analyse vos taches...
          </div>
          <div style={{ "font-size": "11px", color: "var(--text-muted)" }}>
            Cela peut prendre quelques secondes
          </div>
        </div>
      </Show>

      <Show when={!triage.suggestLoading() && triage.suggestions().length > 0}>
        <div style={{
          background: "var(--bg-elevated)",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--accent-primary)",
          padding: "16px",
          "margin-bottom": "20px",
        }}>
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "12px" }}>
            <h3 style={{ margin: "0", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
              Suggestions de l'IA ({triage.suggestions().length})
            </h3>
            <div style={{ display: "flex", gap: "6px" }}>
              <Button size="sm" variant="primary" onClick={applyAllSuggestions}>
                Appliquer tout
              </Button>
              <Button size="sm" variant="ghost" onClick={() => triage.clearSuggestions()}>
                Ignorer
              </Button>
            </div>
          </div>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
            <For each={triage.suggestions()}>
              {(suggestion) => (
                <div style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "10px",
                  padding: "8px 12px",
                  background: "var(--bg-surface)",
                  "border-radius": "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                }}>
                  <div style={{ flex: "1", "min-width": "0" }}>
                    <div style={{
                      "font-size": "12px",
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "white-space": "nowrap",
                    }}>
                      {suggestion.taskTitle}
                    </div>
                    <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>
                      {suggestion.reason}
                    </div>
                  </div>
                  <span style={{
                    "font-size": "10px",
                    padding: "2px 8px",
                    "border-radius": "var(--radius-sm)",
                    background: statusColors[suggestion.suggestedStatus] || "var(--bg-elevated)",
                    color: "#fff",
                    "white-space": "nowrap",
                    "flex-shrink": "0",
                  }}>
                    {statusLabels[suggestion.suggestedStatus] || suggestion.suggestedStatus}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => applySuggestion(suggestion)}>
                    Appliquer
                  </Button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Columns */}
      <div style={{ display: "grid", "grid-template-columns": "1fr 1fr 1fr", gap: "16px" }}>
        <TaskColumn
          title="Prioritaire"
          status="priority"
          color="#ef4444"
          tasks={props.priorityTasks}
          onClickTask={props.onClickTask}
          onMoveTask={props.onMoveTask}
        />
        <TaskColumn
          title="Plus tard"
          status="later"
          color="#3b82f6"
          tasks={props.laterTasks}
          onClickTask={props.onClickTask}
          onMoveTask={props.onMoveTask}
        />
        <TaskColumn
          title="Archive"
          status="archived"
          color="#8b5cf6"
          tasks={props.archivedTasks}
          onClickTask={props.onClickTask}
          onMoveTask={props.onMoveTask}
        />
      </div>

      {/* Untriaged section */}
      <Show when={props.untriagedTasks.length > 0}>
        <UntriagedSection
          tasks={props.untriagedTasks}
          onClickTask={props.onClickTask}
          onStartTriage={props.onStartTriage}
          onMoveTask={props.onMoveTask}
        />
      </Show>
    </div>
  );
}

// --- Columns ---

interface TaskColumnProps {
  title: string;
  status: TriageStatus;
  color: string;
  tasks: Task[];
  onClickTask: (task: Task) => void;
  onMoveTask: (taskId: string, newStatus: TriageStatus) => void;
}

function TaskColumn(props: TaskColumnProps) {
  const isDropTarget = () => activeDrag() !== null && dropTarget() === props.status;

  return (
    <div
      data-triage-status={props.status}
      style={{
        background: isDropTarget() ? `${props.color}15` : "var(--bg-surface)",
        "border-radius": "var(--radius-md)",
        border: `2px ${isDropTarget() ? "dashed" : "solid"} ${isDropTarget() ? props.color : "var(--border-color)"}`,
        overflow: "hidden",
        transition: "background 0.15s, border-color 0.15s",
        "min-height": "120px",
      }}
    >
      <div style={{
        padding: "10px 14px",
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        "border-bottom": "2px solid " + props.color,
      }}>
        <span style={{ "font-size": "13px", "font-weight": "600", color: "var(--text-primary)" }}>
          {props.title}
        </span>
        <span style={{
          "font-size": "11px",
          padding: "1px 8px",
          "border-radius": "var(--radius-sm)",
          background: props.color,
          color: "#fff",
        }}>
          {props.tasks.length}
        </span>
      </div>
      <div style={{ "max-height": "400px", "overflow-y": "auto" }}>
        <For each={props.tasks}>
          {(task) => (
            <DraggableTaskItem task={task} onMoveTask={props.onMoveTask} onClick={() => props.onClickTask(task)} />
          )}
        </For>
        <Show when={props.tasks.length === 0}>
          <div style={{
            padding: "24px 16px",
            "text-align": "center",
            "font-size": "11px",
            color: isDropTarget() ? props.color : "var(--text-muted)",
            transition: "color 0.15s",
          }}>
            {isDropTarget() ? "Deposer ici" : "Aucune tache"}
          </div>
        </Show>
      </div>
    </div>
  );
}

// --- Untriaged section ---

interface UntriagedSectionProps {
  tasks: Task[];
  onClickTask: (task: Task) => void;
  onStartTriage: () => void;
  onMoveTask: (taskId: string, newStatus: TriageStatus) => void;
}

function UntriagedSection(props: UntriagedSectionProps) {
  const [isExpanded, setIsExpanded] = createSignal(true);

  return (
    <div style={{ "margin-top": "24px" }}>
      <div style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        "margin-bottom": "12px",
      }}>
        <button
          onClick={() => setIsExpanded((v) => !v)}
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0",
            color: "var(--text-primary)",
          }}
        >
          <span style={{
            "font-size": "13px",
            "font-weight": "600",
            transition: "transform 0.15s",
            display: "inline-block",
            transform: isExpanded() ? "rotate(90deg)" : "rotate(0deg)",
          }}>&#9654;</span>
          <span style={{ "font-size": "14px", "font-weight": "600" }}>Non triees</span>
          <span style={{
            "font-size": "11px",
            padding: "1px 8px",
            "border-radius": "var(--radius-sm)",
            background: "var(--bg-elevated)",
            color: "var(--text-muted)",
          }}>
            {props.tasks.length}
          </span>
        </button>
        <Button size="sm" variant="primary" onClick={props.onStartTriage}>
          Trier (tinder) &#10022; {props.tasks.length}
        </Button>
      </div>

      <Show when={isExpanded()}>
        <div style={{
          display: "grid",
          "grid-template-columns": "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "8px",
        }}>
          <For each={props.tasks}>
            {(task) => (
              <DraggableTaskItem task={task} card onMoveTask={props.onMoveTask} onClick={() => props.onClickTask(task)} />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// --- Draggable item (pointer events, Tauri-safe) ---

interface DraggableTaskItemProps {
  task: Task;
  onClick: () => void;
  onMoveTask: (taskId: string, newStatus: TriageStatus) => void;
  card?: boolean;
}

function DraggableTaskItem(props: DraggableTaskItemProps) {
  const isDragging = () => activeDrag()?.id === props.task.id;

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();

    const el = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    el.setPointerCapture(pointerId);

    setActiveDrag({ id: props.task.id, name: props.task.title });
    setGhostPos({ x: e.clientX, y: e.clientY });
    setDropTarget(null);

    function onMove(ev: PointerEvent) {
      setGhostPos({ x: ev.clientX, y: ev.clientY });

      // Ghost has pointer-events:none so elementFromPoint sees through it
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const col = under?.closest("[data-triage-status]") as HTMLElement | null;
      setDropTarget((col?.dataset.triageStatus as TriageStatus) ?? null);
    }

    function cleanup() {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", cleanup);
      el.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup);
      try { el.releasePointerCapture(pointerId); } catch {}

      const status = dropTarget();
      setActiveDrag(null);
      setDropTarget(null);

      if (status) {
        props.onMoveTask(props.task.id, status);
      }
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", cleanup);
    el.addEventListener("pointercancel", cleanup);
    window.addEventListener("blur", cleanup);
  }

  function handleClick(e: MouseEvent) {
    // Only fire click if not dragging
    if (!activeDrag()) props.onClick();
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      style={{
        display: "block",
        width: "100%",
        padding: "8px 14px",
        "text-align": "left",
        cursor: isDragging() ? "grabbing" : "grab",
        ...(props.card
          ? {
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-sm)",
            }
          : { "border-bottom": "1px solid var(--border-color)" }),
        transition: "opacity 0.1s",
        opacity: isDragging() ? "0.3" : "1",
        "user-select": "none",
        "box-sizing": "border-box",
      }}
      onMouseEnter={(e) => { if (!isDragging()) e.currentTarget.style.background = "var(--bg-elevated)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = props.card ? "var(--bg-surface)" : "transparent"; }}
    >
      <div style={{
        "font-size": "12px",
        color: "var(--text-primary)",
        overflow: "hidden",
        "text-overflow": "ellipsis",
        "white-space": "nowrap",
      }}>
        {props.task.title}
      </div>
      <div style={{ display: "flex", gap: "6px", "margin-top": "2px" }}>
        <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>{props.task.labels[0] ?? ""}</span>
        <Show when={props.task.priority}>
          <span style={{
            "font-size": "9px",
            padding: "0 4px",
            "border-radius": "2px",
            background: "var(--bg-elevated)",
            color: "var(--text-muted)",
            "text-transform": "capitalize",
          }}>
            {props.task.priority}
          </span>
        </Show>
      </div>
    </div>
  );
}
