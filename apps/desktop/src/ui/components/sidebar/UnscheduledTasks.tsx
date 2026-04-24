import { For, Show, createMemo, createSignal } from "solid-js";
import { useTaskStore } from "../../../application/stores/taskStore";
import { useFluxStore, type FluxStatus } from "../../../application/stores/fluxStore";
import { CookieLoader } from "../common/CookieLoader";
import type { Task } from "../../../domain/models/Task";
import "../../styles/taskjar.css";

function priorityColor(priority: string | null): string | null {
  switch (priority) {
    case "urgent": return "#ef4444";
    case "high": return "#f97316";
    case "normal": return "#3b82f6";
    case "low": return "#9ca3af";
    default: return null;
  }
}

const FLUX_GROUPS: { status: FluxStatus | null; label: string; color: string }[] = [
  { status: "priority", label: "Prioritaire", color: "#f87171" },
  { status: "later", label: "Plus tard", color: "#60a5fa" },
  { status: null, label: "Non trie", color: "var(--text-muted)" },
];

export function UnscheduledTasks() {
  const { tasks: unscheduledTasks, openTaskDetail, syncConnector, isSyncing } = useTaskStore();
  const flux = useFluxStore();

  const grouped = createMemo(() => {
    const allTasks = unscheduledTasks();
    const map = flux.fluxMap();

    return FLUX_GROUPS.map((group) => ({
      ...group,
      tasks: allTasks.filter((t) => {
        const s = map.get(`task:${t.id}`) ?? null;
        return s === group.status;
      }),
    })).filter((g) => g.tasks.length > 0);
  });

  return (
    <div class="taskjar-sidebar">
      <div class="taskjar-sidebar-header">
        <span class="taskjar-sidebar-source">
          ClickUp
          <Show when={isSyncing()}>
            <CookieLoader size={16} />
          </Show>
        </span>
        <button
          class="taskjar-sidebar-sync"
          onClick={() => syncConnector("clickup")}
          disabled={isSyncing()}
        >
          {isSyncing() ? "Sync..." : "Sync"}
        </button>
      </div>

      <For each={grouped()}>
        {(group) => {
          const [collapsed, setCollapsed] = createSignal(true);
          return (
            <div>
              <div
                class="taskjar-sidebar-group-header"
                style={{ cursor: "pointer" }}
                onClick={() => setCollapsed((c) => !c)}
              >
                <svg
                  width="12" height="12" viewBox="0 0 16 16" fill="none"
                  style={{ transition: "transform 0.15s", transform: collapsed() ? "rotate(-90deg)" : "rotate(0deg)", "flex-shrink": "0" }}
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="taskjar-sidebar-group-dot" style={{ background: group.color }} />
                <span class="taskjar-sidebar-group-label" style={{ color: group.color }}>
                  {group.label}
                </span>
                <span class="taskjar-sidebar-group-count">{group.tasks.length}</span>
              </div>

              <Show when={!collapsed()}>
                <For each={group.tasks}>
                  {(task) => <TaskItem task={task} onClick={() => openTaskDetail(task)} />}
                </For>
              </Show>
            </div>
          );
        }}
      </For>

      <Show when={unscheduledTasks().length === 0}>
        <div class="taskjar-sidebar-empty">Aucune tache sans date</div>
      </Show>
    </div>
  );
}

function TaskItem(props: { task: Task; onClick: () => void }) {
  const pColor = () => priorityColor(props.task.priority);

  function handleDragStart(e: DragEvent) {
    const t = props.task;
    const label = t.labels[0] ?? "";
    const md = `- [${t.title}](${t.url ?? ""}) — *${t.status}* (${label})`;
    e.dataTransfer!.setData("application/x-magick-cookie", JSON.stringify({ type: "task", markdown: md }));
    e.dataTransfer!.setData("text/plain", md);
    e.dataTransfer!.effectAllowed = "copy";
  }

  return (
    <button
      class="taskjar-sidebar-item"
      draggable={true}
      onDragStart={handleDragStart}
      onClick={props.onClick}
    >
      <Show when={pColor()}>
        <div class="taskjar-sidebar-priority-dot" style={{ background: pColor()! }} />
      </Show>
      <div style={{ "min-width": "0", flex: "1" }}>
        <div class="taskjar-sidebar-item-title">{props.task.title}</div>
        <div class="taskjar-sidebar-item-meta">
          <span class="taskjar-sidebar-item-status">{props.task.status}</span>
          <span class="taskjar-sidebar-item-label">{props.task.labels[0] ?? ""}</span>
        </div>
      </div>
    </button>
  );
}
