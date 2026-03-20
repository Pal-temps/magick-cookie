import { For, Show, createMemo, createSignal, onMount, onCleanup } from "solid-js";
import { useViewStore } from "../../../application/stores/viewStore";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { EventCard } from "../events/EventCard";
import { CellContextMenu } from "./CellContextMenu";

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WeekView() {
  const { currentDate } = useViewStore();
  const { visibleEvents, openCreateFormAtDate } = useCalendarStore();

  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; date: Date; hour: number } | null>(null);

  // Track container width for compact mode
  let containerRef: HTMLDivElement | undefined;
  const [compact, setCompact] = createSignal(false);

  function checkWidth() {
    if (containerRef) setCompact(containerRef.offsetWidth < 500);
  }

  onMount(() => {
    checkWidth();
    const ro = new ResizeObserver(checkWidth);
    if (containerRef) ro.observe(containerRef);
    onCleanup(() => ro.disconnect());
  });

  const allWeekDays = createMemo(() => {
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

  // In compact mode, show 3 days centered on current day within the week
  const visibleDays = createMemo(() => {
    const all = allWeekDays();
    if (!compact()) return all;

    const todayStr = toLocalDateStr(currentDate());
    let centerIdx = all.findIndex((d) => d.dateStr === todayStr);
    if (centerIdx === -1) centerIdx = 0;

    const start = Math.max(0, Math.min(centerIdx - 1, all.length - 3));
    return all.slice(start, start + 3);
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
    <div ref={containerRef} style={{ display: "flex", "flex-direction": "column", height: "100%", overflow: "auto" }}>
      {/* Header */}
      <div class="week-header" style={{
        "grid-template-columns": compact()
          ? "40px repeat(3, 1fr)"
          : undefined,
      }}>
        <div />
        <For each={visibleDays()}>
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
            <div class="week-hour-row" style={{
              "grid-template-columns": compact()
                ? "40px repeat(3, 1fr)"
                : undefined,
            }}>
              <div class="week-time-label">
                {String(hour).padStart(2, "0")}:00
              </div>
              <For each={visibleDays()}>
                {(day) => {
                  const hourEvents = () => (eventsByDate().get(day.dateStr) ?? [])
                    .filter((ev) => new Date(ev.startAt).getHours() === hour);
                  return (
                    <div class="week-day-cell"
                      onClick={() => openCreateFormAtDate(day.date, hour)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, date: day.date, hour });
                      }}
                      style={{ cursor: "pointer" }}
                    >
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

      <Show when={contextMenu()}>
        {(menu) => (
          <CellContextMenu
            x={menu().x}
            y={menu().y}
            date={menu().date}
            hour={menu().hour}
            onClose={() => setContextMenu(null)}
          />
        )}
      </Show>
    </div>
  );
}
