import { createSignal } from "solid-js";

export interface TimelineBarProps {
  taskId: string;
  title: string;
  priority: string | null;
  startDate: string;
  endDate: string;
  viewStart: Date;
  dayWidth: number;
  onMove: (newStart: string, newEnd: string) => void;
  onClick: () => void;
}

function priorityClass(priority: string | null): string {
  switch (priority) {
    case "urgent": return "taskjar-timeline-bar taskjar-timeline-bar--urgent";
    case "high": return "taskjar-timeline-bar taskjar-timeline-bar--high";
    case "low": return "taskjar-timeline-bar taskjar-timeline-bar--low";
    default: return "taskjar-timeline-bar taskjar-timeline-bar--normal";
  }
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function TimelineBar(props: TimelineBarProps) {
  const [dragging, setDragging] = createSignal(false);
  const [resizing, setResizing] = createSignal(false);
  const [dragOffset, setDragOffset] = createSignal(0);
  const [resizeOffset, setResizeOffset] = createSignal(0);

  const start = () => new Date(props.startDate);
  const end = () => new Date(props.endDate);
  const left = () => daysBetween(props.viewStart, start()) * props.dayWidth + (dragging() ? dragOffset() : 0);
  const duration = () => Math.max(1, daysBetween(start(), end()));
  const width = () => duration() * props.dayWidth + (resizing() ? resizeOffset() : 0);

  function handlePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).classList.contains("taskjar-timeline-bar-handle")) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    setDragging(true);
    setDragOffset(0);
    const startX = e.clientX;

    function onMove(ev: PointerEvent) {
      setDragOffset(ev.clientX - startX);
    }

    function onUp() {
      const dayDelta = Math.round(dragOffset() / props.dayWidth);
      setDragging(false);
      setDragOffset(0);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      if (dayDelta !== 0) {
        const newStart = addDays(start(), dayDelta);
        const newEnd = addDays(end(), dayDelta);
        props.onMove(toISODate(newStart), toISODate(newEnd));
      }
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }

  function handleResizeDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    setResizing(true);
    setResizeOffset(0);
    const startX = e.clientX;

    function onMove(ev: PointerEvent) {
      setResizeOffset(ev.clientX - startX);
    }

    function onUp() {
      const dayDelta = Math.round(resizeOffset() / props.dayWidth);
      setResizing(false);
      setResizeOffset(0);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      if (dayDelta !== 0) {
        const newEnd = addDays(end(), dayDelta);
        if (newEnd > start()) {
          props.onMove(props.startDate, toISODate(newEnd));
        }
      }
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }

  return (
    <div
      class={`${priorityClass(props.priority)} ${dragging() ? "taskjar-timeline-bar--dragging" : ""}`}
      style={{
        left: `${left()}px`,
        width: `${Math.max(width(), props.dayWidth)}px`,
      }}
      onPointerDown={handlePointerDown}
      onClick={(e) => { e.stopPropagation(); props.onClick(); }}
    >
      <span class="taskjar-timeline-bar-title">{props.title}</span>
      <div
        class="taskjar-timeline-bar-handle"
        onPointerDown={handleResizeDown}
      />
    </div>
  );
}
