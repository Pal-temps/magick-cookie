import { For, Show, createSignal } from "solid-js";
import type { Task } from "../../../../domain/models/Task";
import { CollapsibleSection } from "../../common/CollapsibleSection";
import { DateRangePicker } from "../../datetime/DateRangePicker";

export interface TimelineSidebarProps {
  scheduledTasks: Task[];
  unscheduledTasks: Task[];
  onTaskClick: (task: Task) => void;
  onAssignDates: (taskId: string, startDate: string, endDate: string) => void;
  sidebarRef?: (el: HTMLDivElement) => void;
  onScroll?: (e: Event) => void;
}

function priorityDot(priority: string | null): string {
  switch (priority) {
    case "urgent": return "#ef4444";
    case "high": return "#f97316";
    case "low": return "#9ca3af";
    default: return "var(--accent-primary)";
  }
}

export function TimelineSidebar(props: TimelineSidebarProps) {
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editStart, setEditStart] = createSignal("");
  const [editEnd, setEditEnd] = createSignal("");

  function openDatePicker(task: Task) {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    setEditStart(task.startDate ? String(task.startDate).slice(0, 10) : today);
    setEditEnd(task.dueDate ? String(task.dueDate).slice(0, 10) : tomorrow);
    setEditingId(task.id);
  }

  function saveDates() {
    const id = editingId();
    if (id && editStart() && editEnd()) {
      props.onAssignDates(id, editStart(), editEnd());
    }
    setEditingId(null);
  }

  return (
    <div
      class="taskjar-timeline-sidebar"
      ref={props.sidebarRef}
      onScroll={props.onScroll}
    >
      {/* Header spacer to align with grid axis */}
      <div class="taskjar-timeline-sidebar-header">Tache</div>

      {/* Scheduled task rows */}
      <div class="taskjar-timeline-sidebar-rows">
        <For each={props.scheduledTasks}>
          {(task) => (
            <div
              class="taskjar-timeline-sidebar-row"
              onClick={() => props.onTaskClick(task)}
            >
              <div
                class="taskjar-timeline-sidebar-dot"
                style={{ background: priorityDot(task.priority) }}
              />
              <span class="taskjar-timeline-sidebar-title">{task.title}</span>
            </div>
          )}
        </For>
      </div>

      {/* Unscheduled tasks */}
      <Show when={props.unscheduledTasks.length > 0}>
        <div class="taskjar-timeline-sidebar-unscheduled">
          <CollapsibleSection
            title="Sans dates"
            defaultOpen={true}
            badge={
              <span style={{ "font-size": "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 6px", "border-radius": "var(--radius-sm)" }}>
                {props.unscheduledTasks.length}
              </span>
            }
          >
            <For each={props.unscheduledTasks}>
              {(task) => (
                <div class="taskjar-timeline-sidebar-unscheduled-row">
                  <span class="taskjar-timeline-sidebar-title">{task.title}</span>
                  <button
                    class="taskjar-timeline-sidebar-add-date"
                    onClick={(e) => { e.stopPropagation(); openDatePicker(task); }}
                    title="Assigner des dates"
                  >
                    +
                  </button>
                  <Show when={editingId() === task.id}>
                    <div class="taskjar-timeline-date-edit">
                      <DateRangePicker
                        startValue={editStart()}
                        endValue={editEnd()}
                        onStartChange={setEditStart}
                        onEndChange={setEditEnd}
                        isAllDay={true}
                        locale="fr"
                      />
                      <div style={{ display: "flex", gap: "4px", "margin-top": "6px" }}>
                        <button class="taskjar-timeline-date-save" onClick={saveDates}>OK</button>
                        <button class="taskjar-timeline-date-cancel" onClick={() => setEditingId(null)}>Annuler</button>
                      </div>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </CollapsibleSection>
        </div>
      </Show>
    </div>
  );
}
