import { For, Show, createMemo, createSignal } from "solid-js";
import { useViewStore } from "../../../application/stores/viewStore";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { EventCard } from "../events/EventCard";
import { CellContextMenu } from "./CellContextMenu";

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_NAMES_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export function MonthView() {
  const { currentDate } = useViewStore();
  const { visibleEvents, openCreateFormAtDate, updateEvent } = useCalendarStore();

  const [dropTarget, setDropTarget] = createSignal<string | null>(null);

  function handleDrop(e: DragEvent, dateStr: string) {
    e.preventDefault();
    setDropTarget(null);
    const eventId = e.dataTransfer?.getData("application/x-event-id");
    const oldStart = e.dataTransfer?.getData("application/x-event-start");
    const oldEnd = e.dataTransfer?.getData("application/x-event-end");
    if (!eventId || !oldStart || !oldEnd) return;

    const [y, m, d] = dateStr.split("-").map(Number);
    const origStart = new Date(oldStart);
    const origEnd = new Date(oldEnd);
    const diff = origEnd.getTime() - origStart.getTime();

    const newStart = new Date(y, m - 1, d, origStart.getHours(), origStart.getMinutes());
    const newEnd = new Date(newStart.getTime() + diff);

    updateEvent(eventId, { startAt: newStart.toISOString(), endAt: newEnd.toISOString() });
  }

  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; date: Date } | null>(null);

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
      <div class="month-header">
        <For each={DAY_NAMES_FULL}>
          {(d) => <div class="month-header-cell">{d}</div>}
        </For>
      </div>

      {/* Grid */}
      <div class="month-grid">
        <For each={weeks()}>
          {(week) => (
            <div class="month-week">
              <For each={week}>
                {(cell) => {
                  const cellEvents = () => eventsByDate().get(cell.dateStr) ?? [];
                  const isToday = cell.dateStr === todayStr;

                  return (
                    <div class="month-cell"
                      onClick={() => {
                        const [y, m, d] = cell.dateStr.split("-").map(Number);
                        openCreateFormAtDate(new Date(y, m - 1, d));
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const [y, m, d] = cell.dateStr.split("-").map(Number);
                        setContextMenu({ x: e.clientX, y: e.clientY, date: new Date(y, m - 1, d) });
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer!.dropEffect = "move"; setDropTarget(cell.dateStr); }}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={(e) => handleDrop(e, cell.dateStr)}
                      style={{
                        cursor: "pointer",
                        outline: dropTarget() === cell.dateStr ? "2px solid var(--accent-primary)" : "none",
                        "outline-offset": "-2px",
                        transition: "outline 0.1s",
                      }}
                    >
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
                      <div class="month-cell-events">
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

      <Show when={contextMenu()}>
        {(menu) => (
          <CellContextMenu
            x={menu().x}
            y={menu().y}
            date={menu().date}
            onClose={() => setContextMenu(null)}
          />
        )}
      </Show>
    </div>
  );
}
