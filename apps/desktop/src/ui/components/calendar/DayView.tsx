import { For, createMemo } from "solid-js";
import { useViewStore } from "../../../application/stores/viewStore";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { EventCard } from "../events/EventCard";

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DayView() {
  const { currentDate } = useViewStore();
  const { visibleEvents } = useCalendarStore();

  const dateStr = createMemo(() => toLocalDateStr(currentDate()));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const dayLabel = createMemo(() => {
    return currentDate().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  });

  const dayEvents = createMemo(() => {
    return visibleEvents().filter((ev) => toLocalDateStr(new Date(ev.startAt)) === dateStr());
  });

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", overflow: "auto" }}>
      <div style={{
        padding: "12px 16px",
        "font-size": "16px",
        "font-weight": "600",
        "border-bottom": "1px solid var(--border-color)",
        "text-transform": "capitalize",
        position: "sticky",
        top: "0",
        background: "var(--bg-surface)",
        "z-index": "1",
      }}>
        {dayLabel()}
      </div>

      <div style={{ flex: "1" }}>
        <For each={hours}>
          {(hour) => {
            const hourEvents = () => dayEvents().filter((ev) => new Date(ev.startAt).getHours() === hour);
            return (
              <div style={{ display: "grid", "grid-template-columns": "60px 1fr", "min-height": "48px", "border-bottom": "1px solid var(--border-color)" }}>
                <div style={{ "font-size": "11px", color: "var(--text-muted)", padding: "4px 8px", "text-align": "right" }}>
                  {String(hour).padStart(2, "0")}:00
                </div>
                <div style={{ padding: "2px 8px", "border-left": "1px solid var(--border-color)" }}>
                  <For each={hourEvents()}>
                    {(ev) => <EventCard event={ev} />}
                  </For>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
