import { onMount, Show, For, createMemo, createSignal } from "solid-js";
import { useTriageStore, type TriageStatus } from "../../../application/stores/triageStore";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import type { UnscheduledTask } from "../../../domain/models/ClickUpTask";
import { SwipeCard } from "./SwipeCard";
import { Button } from "../common/Button";

export function TriageView() {
  const triage = useTriageStore();
  const { unscheduledTasks, fetchUnscheduledTasks, syncClickUp, isSyncing, openTaskDetail } = useCalendarStore();

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

  // Triage mode — swipe cards
  return (
    <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }} tabIndex={0} onKeyDown={handleKeyboard}>
      <Show when={triage.isTriaging()} fallback={<TriageDashboard
        priorityTasks={priorityTasks()}
        laterTasks={laterTasks()}
        archivedTasks={archivedTasks()}
        untriagedCount={untriagedTasks().length}
        totalCount={unscheduledTasks().length}
        onStartTriage={handleStartTriage}
        onSync={syncClickUp}
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

// Dashboard showing triaged tasks with drag & drop
interface TriageDashboardProps {
  priorityTasks: UnscheduledTask[];
  laterTasks: UnscheduledTask[];
  archivedTasks: UnscheduledTask[];
  untriagedCount: number;
  totalCount: number;
  onStartTriage: () => void;
  onSync: () => void;
  isSyncing: boolean;
  onClickTask: (task: UnscheduledTask) => void;
  onMoveTask: (clickupTaskId: string, newStatus: TriageStatus) => void;
}

function TriageDashboard(props: TriageDashboardProps) {
  return (
    <div style={{ height: "100%", "overflow-y": "auto", padding: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <div>
          <h2 style={{ "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>Triage des taches</h2>
          <p style={{ "font-size": "12px", color: "var(--text-muted)", "margin-top": "4px" }}>
            {props.totalCount} tache(s) au total — {props.untriagedCount} non triee(s)
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button size="sm" variant="secondary" onClick={props.onSync} disabled={props.isSyncing}>
            {props.isSyncing ? "..." : "Sync ClickUp"}
          </Button>
          <Show when={props.untriagedCount > 0}>
            <Button size="sm" variant="primary" onClick={props.onStartTriage}>
              Trier ({props.untriagedCount})
            </Button>
          </Show>
        </div>
      </div>

      {/* Columns */}
      <div style={{ display: "grid", "grid-template-columns": "1fr 1fr 1fr", gap: "16px" }}>
        <TaskColumn
          title="Prioritaire"
          status="priority"
          color="#ef4444"
          tasks={props.priorityTasks}
          onClickTask={props.onClickTask}
          onDrop={props.onMoveTask}
        />
        <TaskColumn
          title="Plus tard"
          status="later"
          color="#3b82f6"
          tasks={props.laterTasks}
          onClickTask={props.onClickTask}
          onDrop={props.onMoveTask}
        />
        <TaskColumn
          title="Archive"
          status="archived"
          color="#8b5cf6"
          tasks={props.archivedTasks}
          onClickTask={props.onClickTask}
          onDrop={props.onMoveTask}
        />
      </div>
    </div>
  );
}

interface TaskColumnProps {
  title: string;
  status: TriageStatus;
  color: string;
  tasks: UnscheduledTask[];
  onClickTask: (task: UnscheduledTask) => void;
  onDrop: (clickupTaskId: string, newStatus: TriageStatus) => void;
}

function TaskColumn(props: TaskColumnProps) {
  const [isDragOver, setIsDragOver] = createSignal(false);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const clickupTaskId = e.dataTransfer?.getData("text/plain");
    if (clickupTaskId) {
      props.onDrop(clickupTaskId, props.status);
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        background: isDragOver() ? `${props.color}11` : "var(--bg-surface)",
        "border-radius": "var(--radius-md)",
        border: `2px ${isDragOver() ? "dashed" : "solid"} ${isDragOver() ? props.color : "var(--border-color)"}`,
        overflow: "hidden",
        transition: "background 0.15s, border 0.15s",
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
            <DraggableTaskItem task={task} onClick={() => props.onClickTask(task)} />
          )}
        </For>
        <Show when={props.tasks.length === 0}>
          <div style={{
            padding: "24px 16px",
            "text-align": "center",
            "font-size": "11px",
            color: isDragOver() ? props.color : "var(--text-muted)",
            transition: "color 0.15s",
          }}>
            {isDragOver() ? "Deposer ici" : "Aucune tache"}
          </div>
        </Show>
      </div>
    </div>
  );
}

interface DraggableTaskItemProps {
  task: UnscheduledTask;
  onClick: () => void;
}

function DraggableTaskItem(props: DraggableTaskItemProps) {
  const [isDragging, setIsDragging] = createSignal(false);

  function handleDragStart(e: DragEvent) {
    if (e.dataTransfer) {
      e.dataTransfer.setData("text/plain", props.task.clickupTaskId);
      e.dataTransfer.effectAllowed = "move";
    }
    setIsDragging(true);
  }

  function handleDragEnd() {
    setIsDragging(false);
  }

  return (
    <div
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={props.onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "8px 14px",
        "text-align": "left",
        cursor: "grab",
        "border-bottom": "1px solid var(--border-color)",
        transition: "background 0.1s, opacity 0.15s",
        opacity: isDragging() ? "0.4" : "1",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <div style={{
        "font-size": "12px",
        color: "var(--text-primary)",
        overflow: "hidden",
        "text-overflow": "ellipsis",
        "white-space": "nowrap",
      }}>
        {props.task.name}
      </div>
      <div style={{ display: "flex", gap: "6px", "margin-top": "2px" }}>
        <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>{props.task.listName}</span>
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
