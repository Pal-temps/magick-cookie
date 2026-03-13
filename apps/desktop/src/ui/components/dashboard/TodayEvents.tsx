import { createMemo, For, Show } from "solid-js";
import { useCalendarStore } from "../../../application/stores/calendarStore";

export function TodayEvents() {
  const { visibleEvents, calendars, openEditForm } = useCalendarStore();

  const todayEvents = createMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 86_400_000 - 1;

    return visibleEvents()
      .filter((e) => {
        const start = new Date(e.startAt).getTime();
        const end = new Date(e.endAt).getTime();
        return start <= endOfDay && end >= startOfDay;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  });

  const getCalColor = (calId: string) =>
    calendars().find((c) => c.id === calId)?.color ?? "var(--accent-primary)";

  return (
    <div style={{
      background: "var(--bg-surface)",
      "border-radius": "var(--radius-lg)",
      border: "1px solid var(--border-color)",
      padding: "20px",
    }}>
      <h3 style={{ margin: "0 0 16px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
        Evenements du jour
      </h3>

      <Show when={todayEvents().length === 0}>
        <div style={{ "font-size": "12px", color: "var(--text-muted)", padding: "8px 0" }}>
          Aucun evenement aujourd'hui
        </div>
      </Show>

      <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
        <For each={todayEvents()}>
          {(event) => {
            const time = () => {
              if (event.isAllDay) return "Journee";
              return new Date(event.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                + " - " + new Date(event.endAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            };

            return (
              <div
                onClick={() => openEditForm(event)}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "10px",
                  padding: "8px 10px",
                  "border-radius": "var(--radius-md)",
                  "border-left": `3px solid ${getCalColor(event.calendarId)}`,
                  background: "var(--bg-elevated)",
                  cursor: "pointer",
                  transition: "var(--transition-fast)",
                }}
              >
                <div style={{ flex: "1", "min-width": "0" }}>
                  <div style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                    {event.title}
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                    {time()}
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
