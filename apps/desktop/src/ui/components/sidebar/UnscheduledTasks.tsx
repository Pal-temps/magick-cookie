import { For, Show, createMemo } from "solid-js";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { useTriageStore, type TriageStatus } from "../../../application/stores/triageStore";
import type { UnscheduledTask } from "../../../domain/models/ClickUpTask";

function priorityColor(priority: string | null): string | null {
  switch (priority) {
    case "urgent": return "#ef4444";
    case "high": return "#f97316";
    case "normal": return "#3b82f6";
    case "low": return "#9ca3af";
    default: return null;
  }
}

const TRIAGE_GROUPS: { status: TriageStatus | null; label: string; color: string }[] = [
  { status: "priority", label: "Prioritaire", color: "#ef4444" },
  { status: "later", label: "Plus tard", color: "#3b82f6" },
  { status: null, label: "Non trie", color: "var(--text-muted)" },
];

export function UnscheduledTasks() {
  const { unscheduledTasks, openTaskDetail } = useCalendarStore();
  const triage = useTriageStore();

  const grouped = createMemo(() => {
    const tasks = unscheduledTasks();
    const map = triage.triageMap();

    return TRIAGE_GROUPS.map((group) => ({
      ...group,
      tasks: tasks.filter((t) => {
        const s = map.get(t.clickupTaskId) ?? null;
        return s === group.status;
      }),
    })).filter((g) => g.tasks.length > 0);
  });

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "0px" }}>
      <For each={grouped()}>
        {(group) => (
          <div>
            {/* Group header */}
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "6px",
              padding: "4px 4px 2px",
            }}>
              <div style={{
                width: "6px",
                height: "6px",
                "border-radius": "50%",
                background: group.color,
                "flex-shrink": "0",
              }} />
              <span style={{
                "font-size": "10px",
                "font-weight": "600",
                color: group.color,
                "text-transform": "uppercase",
                "letter-spacing": "0.5px",
              }}>
                {group.label}
              </span>
              <span style={{
                "font-size": "9px",
                color: "var(--text-muted)",
                "margin-left": "auto",
              }}>
                {group.tasks.length}
              </span>
            </div>

            {/* Tasks */}
            <For each={group.tasks}>
              {(task) => <TaskItem task={task} onClick={() => openTaskDetail(task)} />}
            </For>
          </div>
        )}
      </For>

      <Show when={unscheduledTasks().length === 0}>
        <div style={{ "font-size": "11px", color: "var(--text-muted)", padding: "4px 0" }}>
          Aucune tache sans date
        </div>
      </Show>
    </div>
  );
}

function TaskItem(props: { task: UnscheduledTask; onClick: () => void }) {
  const pColor = () => priorityColor(props.task.priority);

  function handleDragStart(e: DragEvent) {
    const t = props.task;
    const md = `- [${t.name}](${t.url}) — *${t.status}* (${t.listName})`;
    e.dataTransfer!.setData("application/x-do-it-now", JSON.stringify({ type: "task", markdown: md }));
    e.dataTransfer!.setData("text/plain", md);
    e.dataTransfer!.effectAllowed = "copy";
  }

  return (
    <button
      draggable={true}
      onDragStart={handleDragStart}
      onClick={props.onClick}
      style={{
        display: "flex",
        "align-items": "flex-start",
        gap: "8px",
        width: "100%",
        padding: "5px 4px",
        "border-radius": "var(--radius-sm)",
        "text-align": "left",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <Show when={pColor()}>
        <div style={{
          width: "8px",
          height: "8px",
          "border-radius": "50%",
          background: pColor()!,
          "flex-shrink": "0",
          "margin-top": "4px",
        }} />
      </Show>
      <div style={{ "min-width": "0", flex: "1" }}>
        <div style={{
          "font-size": "12px",
          color: "var(--text-primary)",
          overflow: "hidden",
          "text-overflow": "ellipsis",
          "white-space": "nowrap",
        }}>
          {props.task.name}
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-top": "1px" }}>
          <span style={{
            "font-size": "10px",
            padding: "0px 4px",
            "border-radius": "var(--radius-sm)",
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
          }}>
            {props.task.status}
          </span>
          <span style={{
            "font-size": "10px",
            color: "var(--text-muted)",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
          }}>
            {props.task.listName}
          </span>
        </div>
      </div>
    </button>
  );
}
