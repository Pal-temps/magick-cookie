import { For, createMemo } from "solid-js";
import { useViewStore } from "../../../application/stores/viewStore";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { EventCard } from "../events/EventCard";

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MonthView() {
  const { currentDate } = useViewStore();
  const { visibleEvents } = useCalendarStore();

  const weeks = createMemo(() => {
    const d = currentDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { day: number; inMonth: boolean; dateStr: string }[] = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(year, month - 1, day);
      cells.push({ day, inMonth: false, dateStr: toLocalDateStr(date) });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      cells.push({ day, inMonth: true, dateStr: toLocalDateStr(date) });
    }

    const remaining = Math.ceil(cells.length / 7) * 7 - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const date = new Date(year, month + 1, day);
      cells.push({ day, inMonth: false, dateStr: toLocalDateStr(date) });
    }

    const rows: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  });

  const eventsByDate = createMemo(() => {
    const map = new Map<string, typeof visibleEvents extends () => infer R ? R : never>();
    for (const ev of visibleEvents()) {
      const key = toLocalDateStr(new Date(ev.startAt));
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  });

  const todayStr = toLocalDateStr(new Date());

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "grid", "grid-template-columns": "repeat(7, 1fr)", "border-bottom": "1px solid var(--border-color)" }}>
        <For each={["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]}>
          {(d) => (
            <div style={{ padding: "8px", "text-align": "center", "font-size": "12px", "font-weight": "600", color: "var(--text-muted)" }}>
              {d}
            </div>
          )}
        </For>
      </div>

      {/* Grid */}
      <div style={{ flex: "1", display: "flex", "flex-direction": "column" }}>
        <For each={weeks()}>
          {(week) => (
            <div style={{ display: "grid", "grid-template-columns": "repeat(7, 1fr)", flex: "1", "min-height": "0" }}>
              <For each={week}>
                {(cell) => {
                  const cellEvents = () => eventsByDate().get(cell.dateStr) ?? [];
                  const isToday = cell.dateStr === todayStr;

                  return (
                    <div style={{
                      "border-right": "1px solid var(--border-color)",
                      "border-bottom": "1px solid var(--border-color)",
                      "min-height": "80px",
                      overflow: "hidden",
                      display: "flex",
                      "flex-direction": "column",
                    }}>
                      <div style={{
                        padding: "4px 6px",
                        "font-size": "12px",
                        "font-weight": isToday ? "700" : "normal",
                        color: isToday ? "#fff" : !cell.inMonth ? "var(--text-muted)" : "var(--text-secondary)",
                        "text-align": "right",
                        background: isToday ? "var(--accent-primary)" : !cell.inMonth ? "transparent" : "var(--bg-elevated)",
                        "border-bottom": `2px solid ${isToday ? "var(--accent-primary-hover)" : "var(--border-color)"}`,
                      }}>
                        {cell.day}
                      </div>
                      <div style={{ display: "flex", "flex-direction": "column", gap: "2px", padding: "4px", flex: "1" }}>
                        <For each={cellEvents().slice(0, 3)}>
                          {(ev) => <EventCard event={ev} />}
                        </For>
                        {cellEvents().length > 3 && (
                          <span style={{ "font-size": "10px", color: "var(--text-muted)", "text-align": "center" }}>
                            +{cellEvents().length - 3} de plus
                          </span>
                        )}
                      </div>
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
