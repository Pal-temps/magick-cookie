import { For, Show } from "solid-js";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCalendarStore } from "../../../application/stores/calendarStore";

function priorityColor(priority: string | null): string | null {
  switch (priority) {
    case "urgent": return "#ef4444";
    case "high": return "#f97316";
    case "normal": return "#3b82f6";
    case "low": return "#9ca3af";
    default: return null;
  }
}

export function UnscheduledTasks() {
  const { unscheduledTasks } = useCalendarStore();

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "2px" }}>
      <For each={unscheduledTasks()}>
        {(task) => {
          const pColor = priorityColor(task.priority);
          return (
            <button
              onClick={() => openUrl(task.url)}
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
              <Show when={pColor}>
                <div style={{
                  width: "8px",
                  height: "8px",
                  "border-radius": "50%",
                  background: pColor!,
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
                  {task.name}
                </div>
                <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-top": "1px" }}>
                  <span style={{
                    "font-size": "10px",
                    padding: "0px 4px",
                    "border-radius": "var(--radius-sm)",
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                  }}>
                    {task.status}
                  </span>
                  <span style={{
                    "font-size": "10px",
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    "text-overflow": "ellipsis",
                    "white-space": "nowrap",
                  }}>
                    {task.listName}
                  </span>
                </div>
              </div>
            </button>
          );
        }}
      </For>

      <Show when={unscheduledTasks().length === 0}>
        <div style={{ "font-size": "11px", color: "var(--text-muted)", padding: "4px 0" }}>
          Aucune tache sans date
        </div>
      </Show>
    </div>
  );
}
