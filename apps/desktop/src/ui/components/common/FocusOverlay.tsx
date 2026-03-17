import { Show } from "solid-js";
import { useTimerStore } from "../../../application/stores/timerStore";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FocusOverlay() {
  const {
    isFocusMode,
    toggleFocusMode,
    remainingSeconds,
    totalSeconds,
    selectedTaskTitle,
    timerState,
  } = useTimerStore();

  const progressPct = () => {
    const total = totalSeconds();
    if (total === 0) return 0;
    return (remainingSeconds() / total) * 100;
  };

  return (
    <Show when={isFocusMode()}>
      {/* Top progress bar */}
      <div
        style={{
          position: "fixed",
          top: "0",
          left: "0",
          width: "100%",
          height: "3px",
          "z-index": "9999",
          "pointer-events": "none",
          background: "var(--bg-surface)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progressPct()}%`,
            background: "var(--accent-primary)",
            transition: "width 1s linear",
            "border-radius": "0 2px 2px 0",
          }}
        />
      </div>

      {/* Vignette overlay */}
      <div
        style={{
          position: "fixed",
          inset: "0",
          "z-index": "9998",
          "pointer-events": "none",
          "box-shadow": "inset 0 0 120px 40px rgba(0, 0, 0, 0.15)",
        }}
      />

      {/* Floating badge */}
      <div
        style={{
          position: "fixed",
          top: "10px",
          right: "12px",
          "z-index": "10000",
          display: "flex",
          "align-items": "center",
          gap: "8px",
          padding: "5px 12px",
          "border-radius": "var(--radius-md)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-color)",
          "box-shadow": "0 2px 8px rgba(0, 0, 0, 0.12)",
          "font-size": "12px",
          color: "var(--text-secondary)",
          "pointer-events": "auto",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            "border-radius": "50%",
            background: timerState() === "focus" ? "var(--accent-primary)" : "var(--text-muted)",
            "flex-shrink": "0",
            animation: timerState() === "focus" ? "pulse 2s infinite" : "none",
          }}
        />
        <span style={{ "font-weight": "600", color: "var(--text-primary)", "font-variant-numeric": "tabular-nums" }}>
          {formatTime(remainingSeconds())}
        </span>
        <Show when={selectedTaskTitle()}>
          <span
            style={{
              "max-width": "160px",
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
              color: "var(--text-muted)",
            }}
          >
            {selectedTaskTitle()}
          </span>
        </Show>
        <button
          onClick={() => toggleFocusMode()}
          title="Quitter le focus (Echap)"
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            width: "18px",
            height: "18px",
            "border-radius": "50%",
            border: "none",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            "font-size": "14px",
            "line-height": "1",
            padding: "0",
            "margin-left": "2px",
          }}
        >
          &times;
        </button>
      </div>
    </Show>
  );
}
