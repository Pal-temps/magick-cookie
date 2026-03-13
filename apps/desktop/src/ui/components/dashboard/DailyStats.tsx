import { useTimerStore } from "../../../application/stores/timerStore";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export function DailyStats() {
  const { todayStats } = useTimerStore();

  return (
    <div style={{
      background: "var(--bg-surface)",
      "border-radius": "var(--radius-lg)",
      border: "1px solid var(--border-color)",
      padding: "20px",
    }}>
      <h3 style={{ margin: "0 0 16px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
        Aujourd'hui
      </h3>

      <div style={{ display: "flex", gap: "16px" }}>
        <div style={{
          flex: "1",
          "text-align": "center",
          padding: "12px",
          "border-radius": "var(--radius-md)",
          background: "var(--bg-elevated)",
        }}>
          <div style={{ "font-size": "24px", "font-weight": "700", color: "var(--accent-primary)", "font-variant-numeric": "tabular-nums" }}>
            {formatDuration(todayStats().totalSeconds)}
          </div>
          <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>
            Temps de focus
          </div>
        </div>
        <div style={{
          flex: "1",
          "text-align": "center",
          padding: "12px",
          "border-radius": "var(--radius-md)",
          background: "var(--bg-elevated)",
        }}>
          <div style={{ "font-size": "24px", "font-weight": "700", color: "var(--accent-primary)", "font-variant-numeric": "tabular-nums" }}>
            {todayStats().sessionCount}
          </div>
          <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>
            Sessions
          </div>
        </div>
      </div>
    </div>
  );
}
