import { For, createMemo } from "solid-js";
import type { Task } from "../../../../domain/models/Task";
import { TimelineBar } from "./TimelineBar";

export interface TimelineGridProps {
  tasks: Task[];
  viewStart: Date;
  viewEnd: Date;
  dayWidth: number;
  onBarMove: (taskId: string, newStart: string, newEnd: string) => void;
  onBarClick: (task: Task) => void;
  gridRef?: (el: HTMLDivElement) => void;
  onScroll?: (e: Event) => void;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

interface DayCol {
  date: Date;
  label: string;
  isWeekend: boolean;
  isToday: boolean;
  monthLabel: string | null;
}

function buildDays(start: Date, end: Date): DayCol[] {
  const days: DayCol[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toDateString();

  const MONTHS_FR = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];

  let lastMonth = -1;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay();
    const month = d.getMonth();
    days.push({
      date: new Date(d),
      label: String(d.getDate()),
      isWeekend: dow === 0 || dow === 6,
      isToday: d.toDateString() === todayStr,
      monthLabel: month !== lastMonth ? `${MONTHS_FR[month]} ${d.getFullYear()}` : null,
    });
    lastMonth = month;
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function TimelineGrid(props: TimelineGridProps) {
  const days = createMemo(() => buildDays(props.viewStart, props.viewEnd));
  const totalWidth = createMemo(() => days().length * props.dayWidth);

  function taskStart(task: Task): string {
    return task.startDate
      ? (typeof task.startDate === "string" ? task.startDate : (task.startDate as Date).toISOString()).slice(0, 10)
      : task.dueDate
        ? (typeof task.dueDate === "string" ? task.dueDate : (task.dueDate as Date).toISOString()).slice(0, 10)
        : "";
  }

  function taskEnd(task: Task): string {
    if (task.dueDate) {
      return (typeof task.dueDate === "string" ? task.dueDate : (task.dueDate as Date).toISOString()).slice(0, 10);
    }
    if (task.startDate) {
      const s = new Date(task.startDate);
      s.setDate(s.getDate() + 1);
      return s.toISOString().slice(0, 10);
    }
    return "";
  }

  return (
    <div
      class="taskjar-timeline-grid"
      ref={props.gridRef}
      onScroll={props.onScroll}
    >
      <div style={{ "min-width": `${totalWidth()}px` }}>
        {/* Month headers */}
        <div class="taskjar-timeline-axis-months" style={{ width: `${totalWidth()}px` }}>
          <For each={days().filter((d) => d.monthLabel)}>
            {(day) => {
              const idx = days().indexOf(day);
              let span = 1;
              for (let i = idx + 1; i < days().length && !days()[i].monthLabel; i++) span++;
              return (
                <div
                  class="taskjar-timeline-axis-month"
                  style={{ left: `${idx * props.dayWidth}px`, width: `${span * props.dayWidth}px` }}
                >
                  {day.monthLabel}
                </div>
              );
            }}
          </For>
        </div>

        {/* Day headers */}
        <div class="taskjar-timeline-axis-days" style={{ width: `${totalWidth()}px` }}>
          <For each={days()}>
            {(day) => (
              <div
                class={`taskjar-timeline-axis-day ${day.isToday ? "taskjar-timeline-axis-day--today" : ""} ${day.isWeekend ? "taskjar-timeline-axis-day--weekend" : ""}`}
                style={{ width: `${props.dayWidth}px` }}
              >
                {day.label}
              </div>
            )}
          </For>
        </div>

        {/* Rows */}
        <div class="taskjar-timeline-rows" style={{ position: "relative" }}>
          {/* Background columns */}
          <div class="taskjar-timeline-bg" style={{ width: `${totalWidth()}px`, height: `${props.tasks.length * 36}px` }}>
            <For each={days()}>
              {(day, i) => (
                <div
                  class={`taskjar-timeline-col ${day.isWeekend ? "taskjar-timeline-col--weekend" : ""} ${day.isToday ? "taskjar-timeline-col--today" : ""}`}
                  style={{ left: `${i() * props.dayWidth}px`, width: `${props.dayWidth}px` }}
                />
              )}
            </For>
          </div>

          {/* Task rows with bars */}
          <For each={props.tasks}>
            {(task) => (
              <div class="taskjar-timeline-row">
                <TimelineBar
                  taskId={task.id}
                  title={task.title}
                  priority={task.priority}
                  startDate={taskStart(task)}
                  endDate={taskEnd(task)}
                  viewStart={props.viewStart}
                  dayWidth={props.dayWidth}
                  onMove={(s, e) => props.onBarMove(task.id, s, e)}
                  onClick={() => props.onBarClick(task)}
                />
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
