import { Show } from "solid-js";
import { useTimerStore } from "../../../application/stores/timerStore";

export function FocusOverlay() {
  const { isFocusMode, remainingSeconds, totalSeconds } = useTimerStore();

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
    </Show>
  );
}
