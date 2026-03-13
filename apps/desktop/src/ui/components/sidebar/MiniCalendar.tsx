import { For, createMemo } from "solid-js";
import { useViewStore } from "../../../application/stores/viewStore";

export function MiniCalendar() {
  const { currentDate, setCurrentDate, setSelectedDate } = useViewStore();

  const weeks = createMemo(() => {
    const d = currentDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday start
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { day: number; inMonth: boolean; date: Date }[] = [];

    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      cells.push({ day, inMonth: false, date: new Date(year, month - 1, day) });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, inMonth: true, date: new Date(year, month, day) });
    }

    // Next month padding
    const remaining = 42 - cells.length;
    for (let day = 1; day <= remaining; day++) {
      cells.push({ day, inMonth: false, date: new Date(year, month + 1, day) });
    }

    const rows: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  });

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const monthLabel = createMemo(() => {
    return currentDate().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  });

  return (
    <div style={{ padding: "12px" }}>
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "8px" }}>
        <button
          onClick={() => { const d = new Date(currentDate()); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }}
          style={{ color: "var(--text-secondary)", "font-size": "14px", padding: "2px 6px" }}
        >&lt;</button>
        <span style={{ "font-size": "13px", "font-weight": "600", "text-transform": "capitalize" }}>{monthLabel()}</span>
        <button
          onClick={() => { const d = new Date(currentDate()); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }}
          style={{ color: "var(--text-secondary)", "font-size": "14px", padding: "2px 6px" }}
        >&gt;</button>
      </div>
      <div style={{ display: "grid", "grid-template-columns": "repeat(7, 1fr)", gap: "1px", "text-align": "center", "font-size": "11px" }}>
        <For each={["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"]}>
          {(d) => <div style={{ color: "var(--text-muted)", padding: "2px", "font-weight": "600" }}>{d}</div>}
        </For>
        <For each={weeks()}>
          {(week) => (
            <For each={week}>
              {(cell) => (
                <button
                  onClick={() => { setSelectedDate(cell.date); setCurrentDate(cell.date); }}
                  style={{
                    padding: "3px",
                    "border-radius": "var(--radius-sm)",
                    color: !cell.inMonth ? "var(--text-muted)" : isToday(cell.date) ? "var(--bg-base)" : "var(--text-primary)",
                    background: isToday(cell.date) ? "var(--accent-primary)" : "transparent",
                    "font-weight": isToday(cell.date) ? "700" : "normal",
                    "font-size": "11px",
                  }}
                >
                  {cell.day}
                </button>
              )}
            </For>
          )}
        </For>
      </div>
    </div>
  );
}
