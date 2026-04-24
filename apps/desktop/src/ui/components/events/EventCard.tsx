import { createMemo } from "solid-js";
import type { CalendarEvent } from "../../../domain/models/CalendarEvent";
import { useCalendarStore } from "../../../application/stores/calendarStore";

interface EventCardProps {
  event: CalendarEvent;
}

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  task: { label: "T", color: "#7B68EE" },
  personal: { label: "P", color: "#00b894" },
  birthday: { label: "AN", color: "#fd79a8" },
  alarm: { label: "A", color: "#e17055" },
};

function getEventSource(event: CalendarEvent): string {
  if (event._isAlarm) return "alarm";
  if (event._isBirthday) return "birthday";
  if (event.taskId) return "task";
  return "personal";
}

export function EventCard(props: EventCardProps) {
  const { calendars, openEditForm } = useCalendarStore();

  const calColor = createMemo(() => {
    const cal = calendars().find((c) => c.id === props.event.calendarId);
    return cal?.color ?? "var(--accent-primary)";
  });

  const timeLabel = createMemo(() => {
    if (props.event.isAllDay) return "Journee";
    const start = new Date(props.event.startAt);
    return start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  });

  const source = createMemo(() => {
    const key = getEventSource(props.event);
    return SOURCE_BADGE[key];
  });

  const isDraggable = () => !props.event._isBirthday && !props.event._isAlarm;

  return (
    <button
      draggable={isDraggable()}
      onDragStart={(e) => {
        if (!isDraggable()) return;
        e.stopPropagation();
        e.dataTransfer!.effectAllowed = "move";
        e.dataTransfer!.setData("application/x-event-id", props.event.id);
        e.dataTransfer!.setData("application/x-event-start", props.event.startAt);
        e.dataTransfer!.setData("application/x-event-end", props.event.endAt);
        (e.currentTarget as HTMLElement).style.opacity = "0.4";
      }}
      onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      onClick={(e) => { e.stopPropagation(); openEditForm(props.event); }}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "6px",
        width: "100%",
        padding: "2px 4px",
        "border-radius": "var(--radius-sm)",
        "text-align": "left",
        "font-size": "11px",
        overflow: "hidden",
        "white-space": "nowrap",
        background: `${calColor()}22`,
        "border-left": `3px solid ${calColor()}`,
        cursor: isDraggable() ? "grab" : "default",
      }}
    >
      <span
        title={source().label === "T" ? "Tache" : source().label === "AN" ? "Anniversaire" : source().label === "A" ? "Alarme" : "Personnel"}
        style={{
          "font-size": "8px",
          "font-weight": "700",
          "line-height": "1",
          padding: "2px 3px",
          "border-radius": "3px",
          background: `${source().color}33`,
          color: source().color,
          "flex-shrink": "0",
          "letter-spacing": "0.5px",
        }}
      >
        {source().label}
      </span>
      <span style={{ color: "var(--text-secondary)", "flex-shrink": "0" }}>{timeLabel()}</span>
      <span style={{ overflow: "hidden", "text-overflow": "ellipsis" }}>{props.event.title}</span>
    </button>
  );
}
