import { For, createMemo } from "solid-js";
import { useViewStore } from "../../../application/stores/viewStore";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { EventCard } from "../events/EventCard";

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WeekView() {
  const { currentDate } = useViewStore();
  const { visibleEvents } = useCalendarStore();

  const weekDays = createMemo(() => {
    const d = currentDate();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return {
        date,
        dateStr: toLocalDateStr(date),
        label: date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      };
    });
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const todayStr = toLocalDateStr(new Date());

  const eventsByDate = createMemo(() => {
    const map = new Map<string, ReturnType<typeof visibleEvents>>();
    for (const ev of visibleEvents()) {
      const key = toLocalDateStr(new Date(ev.startAt));
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  });

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", overflow: "auto" }}>
      {/* Header */}
      <div style={{ display: "grid", "grid-template-columns": "60px repeat(7, 1fr)", "border-bottom": "1px solid var(--border-color)", position: "sticky", top: "0", background: "var(--bg-surface)", "z-index": "1" }}>
        <div />
        <For each={weekDays()}>
          {(day) => (
            <div style={{
              padding: "8px 4px",
              "text-align": "center",
              "font-size": "12px",
              "font-weight": day.dateStr === todayStr ? "700" : "500",
              color: day.dateStr === todayStr ? "var(--accent-primary)" : "var(--text-secondary)",
              "text-transform": "capitalize",
            }}>
              {day.label}
            </div>
          )}
        </For>
      </div>

      {/* Time grid */}
      <div style={{ flex: "1" }}>
        <For each={hours}>
          {(hour) => (
            <div style={{ display: "grid", "grid-template-columns": "60px repeat(7, 1fr)", "min-height": "48px", "border-bottom": "1px solid var(--border-color)" }}>
              <div style={{ "font-size": "11px", color: "var(--text-muted)", padding: "4px 8px", "text-align": "right" }}>
                {String(hour).padStart(2, "0")}:00
              </div>
              <For each={weekDays()}>
                {(day) => {
                  const hourEvents = () => (eventsByDate().get(day.dateStr) ?? [])
                    .filter((ev) => new Date(ev.startAt).getHours() === hour);
                  return (
                    <div style={{ "border-left": "1px solid var(--border-color)", padding: "2px", "min-height": "48px" }}>
                      <For each={hourEvents()}>
                        {(ev) => <EventCard event={ev} />}
                      </For>
                    </div>
                  );
                }}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
