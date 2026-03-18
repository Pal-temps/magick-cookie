import { Show } from "solid-js";
import { useTimerStore } from "../../../application/stores/timerStore";
import { useViewStore } from "../../../application/stores/viewStore";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MiniTimer() {
  const { timerState, remainingSeconds, acknowledgeBreak } = useTimerStore();
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
      <button
        onClick={() => timerState() === "waiting" ? acknowledgeBreak() : setViewMode("dashboard")}
        title={timerState() === "waiting" ? "Cliquer pour lancer la pause" : "Voir le timer"}
        style={{
          display: "inline-flex",
          "align-items": "center",
          gap: "6px",
          padding: "3px 10px",
          "border-radius": "var(--radius-md)",
          background: timerState() === "waiting" ? "var(--cal-red, #e74c3c)" : "var(--bg-elevated)",
          border: `1px solid ${stateColor()}`,
          cursor: "pointer",
          transition: "var(--transition-fast)",
          animation: timerState() === "waiting" ? "pulse 1s infinite" : "none",
        }}
      >
        <span style={{
          width: "8px",
          height: "8px",
          "border-radius": "50%",
          background: timerState() === "waiting" ? "#fff" : stateColor(),
          animation: timerState() === "focus" ? "pulse 2s infinite" : "none",
        }} />
        <span style={{
          "font-size": "13px",
          "font-weight": "600",
          color: timerState() === "waiting" ? "#fff" : "var(--text-primary)",
          "font-variant-numeric": "tabular-nums",
        }}>
          {timerState() === "waiting" ? "Pause ?" : formatTime(remainingSeconds())}
        </span>
      </button>
    </Show>
  );
}
