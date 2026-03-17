import { Show, For, createMemo } from "solid-js";
import { useAnalyticsStore } from "../../../application/stores/analyticsStore";

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  return `${m}min`;
}

export function TaskTimeChart() {
  const { timeByTask } = useAnalyticsStore();

  const maxSeconds = createMemo(() => {
    const entries = timeByTask();
    if (entries.length === 0) return 1;
    return Math.max(...entries.map((e) => e.totalSeconds), 1);
  });

  const visibleEntries = createMemo(() => timeByTask().slice(0, 10));
  const hiddenCount = createMemo(() => Math.max(0, timeByTask().length - 10));

  return (
    <div style={{ "margin-top": "24px" }}>
      <h3 style={{ margin: "0 0 16px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
        Temps par tache
      </h3>

      <Show when={timeByTask().length === 0}>
        <div style={{ color: "var(--text-muted)", "font-size": "12px", "text-align": "center", padding: "20px" }}>
          Aucune donnee sur cette periode
        </div>
      </Show>

      <Show when={timeByTask().length > 0}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
          <For each={visibleEntries()}>
            {(entry, index) => {
              const barWidth = () => Math.max(4, (entry.totalSeconds / maxSeconds()) * 100);
              const opacity = () => Math.max(0.3, 1 - index() * 0.07);
              const label = () => entry.taskTitle || (entry.taskId ? `Tache ${entry.taskId.slice(0, 8)}` : "Sans tache");

              return (
                <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                  <div
                    style={{
                      "min-width": "120px",
                      "max-width": "180px",
                      "font-size": "12px",
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "white-space": "nowrap",
                      "text-align": "right",
                    }}
                    title={label()}
                  >
                    {label()}
                  </div>
                  <div style={{ flex: "1", height: "20px", background: "var(--bg-elevated)", "border-radius": "var(--radius-sm)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${barWidth()}%`,
                        height: "100%",
                        background: `var(--accent-primary)`,
                        opacity: opacity(),
                        "border-radius": "var(--radius-sm)",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      "min-width": "70px",
                      "font-size": "11px",
                      color: "var(--text-muted)",
                      "text-align": "right",
                      "white-space": "nowrap",
                    }}
                  >
                    {formatSeconds(entry.totalSeconds)}
                    <span style={{ "margin-left": "4px", "font-size": "10px" }}>
                      ({entry.sessionCount}s)
                    </span>
                  </div>
                </div>
              );
            }}
          </For>
        </div>

        <Show when={hiddenCount() > 0}>
          <div style={{ "margin-top": "8px", "font-size": "11px", color: "var(--text-muted)", "text-align": "center" }}>
            et {hiddenCount()} autre{hiddenCount() > 1 ? "s" : ""}
          </div>
        </Show>
      </Show>
    </div>
  );
}
