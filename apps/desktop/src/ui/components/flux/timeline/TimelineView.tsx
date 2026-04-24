import { onMount, createMemo, createSignal } from "solid-js";
import { useTaskStore } from "../../../../application/stores/taskStore";
import { TimelineGrid } from "./TimelineGrid";
import { TimelineSidebar } from "./TimelineSidebar";
import { Button } from "../../common/Button";

type Zoom = "week" | "2weeks" | "month";
const ZOOM_CONFIG: Record<Zoom, { dayWidth: number; days: number }> = {
  week: { dayWidth: 80, days: 10 },
  "2weeks": { dayWidth: 50, days: 18 },
  month: { dayWidth: 28, days: 35 },
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function TimelineView() {
  const taskStore = useTaskStore();
  const [zoom, setZoom] = createSignal<Zoom>("2weeks");
  const [viewStart, setViewStart] = createSignal(getMonday(new Date()));

  let sidebarEl: HTMLDivElement | undefined;
  let gridEl: HTMLDivElement | undefined;

  onMount(async () => {
    if (taskStore.tasks().length === 0) await taskStore.fetchTasks();
  });

  const viewEnd = createMemo(() => addDays(viewStart(), ZOOM_CONFIG[zoom()].days));
  const dayWidth = createMemo(() => ZOOM_CONFIG[zoom()].dayWidth);

  const scheduledTasks = createMemo(() =>
    taskStore.tasks().filter((t) => t.startDate || t.dueDate)
  );

  const unscheduledTasks = createMemo(() =>
    taskStore.tasks().filter((t) => !t.startDate && !t.dueDate)
  );

  function handleBarMove(taskId: string, newStart: string, newEnd: string) {
    taskStore.updateTask(taskId, { startDate: newStart, dueDate: newEnd });
  }

  function handleAssignDates(taskId: string, startDate: string, endDate: string) {
    taskStore.updateTask(taskId, {
      startDate: startDate.slice(0, 10),
      dueDate: endDate.slice(0, 10),
    });
  }

  function handleBarClick(task: { id: string }) {
    const t = taskStore.tasks().find((tt) => tt.id === task.id);
    if (t) taskStore.openTaskDetail(t);
  }

  function navigateWeek(dir: number) {
    setViewStart((prev) => addDays(prev, dir * 7));
  }

  function goToToday() {
    setViewStart(getMonday(new Date()));
  }

  function syncScroll(source: "sidebar" | "grid") {
    return () => {
      if (source === "grid" && gridEl && sidebarEl) {
        sidebarEl.scrollTop = gridEl.scrollTop;
      } else if (source === "sidebar" && sidebarEl && gridEl) {
        gridEl.scrollTop = sidebarEl.scrollTop;
      }
    };
  }

  return (
    <div class="taskjar-timeline-container">
      {/* Controls */}
      <div class="taskjar-timeline-controls">
        <div style={{ display: "flex", gap: "4px" }}>
          <Button size="sm" variant="ghost" onClick={() => navigateWeek(-1)}>&#8249;</Button>
          <Button size="sm" variant="secondary" onClick={goToToday}>Aujourd'hui</Button>
          <Button size="sm" variant="ghost" onClick={() => navigateWeek(1)}>&#8250;</Button>
        </div>
        <div class="taskjar-timeline-zoom">
          <button
            class={`taskjar-tab ${zoom() === "week" ? "taskjar-tab--active" : ""}`}
            onClick={() => setZoom("week")}
          >Semaine</button>
          <button
            class={`taskjar-tab ${zoom() === "2weeks" ? "taskjar-tab--active" : ""}`}
            onClick={() => setZoom("2weeks")}
          >2 Sem.</button>
          <button
            class={`taskjar-tab ${zoom() === "month" ? "taskjar-tab--active" : ""}`}
            onClick={() => setZoom("month")}
          >Mois</button>
        </div>
      </div>

      {/* Main layout */}
      <div class="taskjar-timeline">
        <TimelineSidebar
          scheduledTasks={scheduledTasks()}
          unscheduledTasks={unscheduledTasks()}
          onTaskClick={(t) => handleBarClick(t)}
          onAssignDates={handleAssignDates}
          sidebarRef={(el) => { sidebarEl = el; }}
          onScroll={syncScroll("sidebar")}
        />
        <TimelineGrid
          tasks={scheduledTasks()}
          viewStart={viewStart()}
          viewEnd={viewEnd()}
          dayWidth={dayWidth()}
          onBarMove={handleBarMove}
          onBarClick={handleBarClick}
          gridRef={(el) => { gridEl = el; }}
          onScroll={syncScroll("grid")}
        />
      </div>
    </div>
  );
}
