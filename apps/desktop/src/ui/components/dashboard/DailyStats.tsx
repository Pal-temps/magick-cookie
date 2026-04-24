import { useTimerStore } from "../../../application/stores/timerStore";
import { useT } from "../../../i18n/context";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export function DailyStats() {
  const { todayStats } = useTimerStore();
  const { t } = useT();

  return (
    <div>
      <div style={{ display: "flex", gap: "8px" }}>
        <div style={{
          flex: "1",
          "text-align": "center",
          padding: "10px 8px",
          "border-radius": "var(--radius-md)",
          background: "var(--bg-elevated)",
          "min-width": "0",
        }}>
          <div style={{ "font-size": "20px", "font-weight": "700", color: "var(--accent-primary)", "font-variant-numeric": "tabular-nums" }}>
            {formatDuration(todayStats().totalSeconds)}
          </div>
          <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "4px" }}>
            {t("dashboard.focus")}
          </div>
        </div>
        <div style={{
          flex: "1",
          "text-align": "center",
          padding: "10px 8px",
          "border-radius": "var(--radius-md)",
          background: "var(--bg-elevated)",
          "min-width": "0",
        }}>
          <div style={{ "font-size": "20px", "font-weight": "700", color: "var(--accent-primary)", "font-variant-numeric": "tabular-nums" }}>
            {todayStats().sessionCount}
          </div>
          <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "4px" }}>
            {t("dashboard.sessions")}
          </div>
        </div>
      </div>
    </div>
  );
}
