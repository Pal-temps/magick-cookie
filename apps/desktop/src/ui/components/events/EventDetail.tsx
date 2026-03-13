import { Show, createMemo } from "solid-js";
import type { CalendarEvent } from "../../../domain/models/CalendarEvent";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { Button } from "../common/Button";

interface EventDetailProps {
  event: CalendarEvent;
  onClose: () => void;
}

export function EventDetail(props: EventDetailProps) {
  const { calendars, deleteEvent, openEditForm } = useCalendarStore();

  const calendar = createMemo(() => calendars().find((c) => c.id === props.event.calendarId));

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  async function handleDelete() {
    await deleteEvent(props.event.id);
    props.onClose();
  }

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "16px" }}>
        <div style={{ width: "12px", height: "12px", "border-radius": "3px", background: calendar()?.color ?? "var(--accent-primary)" }} />
        <span style={{ "font-size": "11px", color: "var(--text-secondary)" }}>{calendar()?.name}</span>
      </div>

      <h3 style={{ "font-size": "20px", "font-weight": "600", "margin-bottom": "12px" }}>{props.event.title}</h3>

      <div style={{ "font-size": "13px", color: "var(--text-secondary)", "margin-bottom": "8px" }}>
        {formatDate(props.event.startAt)} &rarr; {formatDate(props.event.endAt)}
      </div>

      <Show when={props.event.location}>
        <div style={{ "font-size": "13px", color: "var(--text-secondary)", "margin-bottom": "8px" }}>
          {props.event.location}
        </div>
      </Show>

      <Show when={props.event.description}>
        <p style={{ "font-size": "13px", color: "var(--text-secondary)", "margin-top": "12px", "white-space": "pre-wrap" }}>
          {props.event.description}
        </p>
      </Show>

      <div style={{ display: "flex", gap: "8px", "margin-top": "20px" }}>
        <Button variant="primary" onClick={() => openEditForm(props.event)}>Modifier</Button>
        <Button variant="danger" onClick={handleDelete}>Supprimer</Button>
      </div>
    </div>
  );
}
