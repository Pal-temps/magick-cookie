import { onMount, Show, For } from "solid-js";
import { useAnalyticsStore } from "../../../application/stores/analyticsStore";
import { CookieLoader } from "../common/CookieLoader";
import { useT } from "../../../i18n/context";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function intensityColor(totalSeconds: number): string {
  if (totalSeconds === 0) return "var(--bg-elevated)";
  if (totalSeconds < 1800) return "var(--accent-primary-dim, rgba(99, 102, 241, 0.3))";
  if (totalSeconds < 3600) return "var(--accent-primary-muted, rgba(99, 102, 241, 0.6))";
  return "var(--accent-primary)";
}

export function StreakWidget() {
  const { streak, fetchStreak } = useAnalyticsStore();
  const { t } = useT();

  onMount(() => {
    fetchStreak();
  });

  return (
    <div>
      <Show when={streak()} fallback={
        <CookieLoader size={32} message={t("common.loading")} />
      }>
        {(data) => (
          <>
            <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "4px" }}>
              <span style={{ "font-size": "20px" }}>&#128293;</span>
              <span style={{
                "font-size": "28px",
                "font-weight": "700",
                color: "var(--accent-primary)",
                "font-variant-numeric": "tabular-nums",
                "line-height": "1",
              }}>
                {data().currentStreak}
              </span>
              <span style={{ "font-size": "14px", color: "var(--text-secondary)", "font-weight": "500" }}>
                {t("dashboard.days")}
              </span>
            </div>

            <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "14px" }}>
              {t("dashboard.record")} : {data().longestStreak} {t("dashboard.days")}
            </div>

            <div style={{
              display: "grid",
              "grid-template-columns": "repeat(auto-fill, minmax(14px, 1fr))",
              gap: "3px",
            }}>
              <For each={data().last30Days}>
                {(day) => (
                  <div
                    title={`${day.date} — ${formatDuration(day.totalSeconds)}`}
                    style={{
                      width: "100%",
                      "aspect-ratio": "1",
                      "border-radius": "3px",
                      background: intensityColor(day.totalSeconds),
                      transition: "opacity 0.15s",
                    }}
                  />
                )}
              </For>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
