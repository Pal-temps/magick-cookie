import { Show } from "solid-js";
import { useTimerStore } from "../../../application/stores/timerStore";
import { useViewStore } from "../../../application/stores/viewStore";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MiniTimer() {
  const { timerState, remainingSeconds, dismissSound, startBreak } = useTimerStore();
  const { setViewMode } = useViewStore();

  const stateColor = () => {
    switch (timerState()) {
      case "focus": return "var(--accent-primary)";
      case "break": return "var(--cal-green)";
      case "waiting": return "var(--cal-red, #e74c3c)";
      case "paused": return "var(--text-muted)";
      default: return "transparent";
    }
  };

  return (
    <Show when={timerState() !== "idle"}>
      <Show when={timerState() === "waiting"} fallback={
        <button
          onClick={() => setViewMode("dashboard")}
          title="Voir le timer"
          style={{
            display: "inline-flex",
            "align-items": "center",
            gap: "6px",
            padding: "3px 10px",
            "border-radius": "var(--radius-md)",
            background: "var(--bg-elevated)",
            border: `1px solid ${stateColor()}`,
            cursor: "pointer",
            transition: "var(--transition-fast)",
          }}
        >
          <span style={{
            width: "8px", height: "8px", "border-radius": "50%",
            background: stateColor(),
            animation: timerState() === "focus" ? "pulse 2s infinite" : "none",
          }} />
          <span style={{ "font-size": "13px", "font-weight": "600", color: "var(--text-primary)", "font-variant-numeric": "tabular-nums" }}>
            {formatTime(remainingSeconds())}
          </span>
        </button>
      }>
        <div style={{ display: "inline-flex", gap: "4px", "align-items": "center" }}>
          <button
            onClick={dismissSound}
            title="Couper le son"
            style={{
              display: "inline-flex", "align-items": "center", padding: "3px 8px",
              "border-radius": "var(--radius-md)", background: "var(--bg-elevated)",
              border: "1px solid var(--border-color)", cursor: "pointer", "font-size": "14px",
            }}
          >🔇</button>
          <button
            onClick={startBreak}
            title="Lancer la pause"
            style={{
              display: "inline-flex", "align-items": "center", gap: "4px", padding: "3px 10px",
              "border-radius": "var(--radius-md)", background: "var(--cal-green, #27ae60)",
              border: "none", cursor: "pointer", color: "#fff", "font-size": "12px", "font-weight": "600",
              animation: "pulse 1s infinite",
            }}
          >Pause</button>
        </div>
      </Show>
    </Show>
  );
}
