import { Show } from "solid-js";
import { useDogWalkStore } from "../../../application/stores/dogWalkStore";
import { useViewStore } from "../../../application/stores/viewStore";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function MiniDogWalk() {
  const { activeWalk, elapsedSeconds } = useDogWalkStore();
  const { setViewMode } = useViewStore();

  return (
    <Show when={activeWalk()}>
      <button
        onClick={() => setViewMode("dashboard")}
        style={{
          display: "inline-flex",
          "align-items": "center",
          gap: "6px",
          padding: "3px 10px",
          "border-radius": "var(--radius-md)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--cal-green)",
          cursor: "pointer",
          transition: "var(--transition-fast)",
        }}
      >
        <span style={{ "font-size": "12px" }}>🐕</span>
        <span style={{
          "font-size": "13px",
          "font-weight": "600",
          color: "var(--cal-green)",
          "font-variant-numeric": "tabular-nums",
        }}>
          {formatElapsed(elapsedSeconds())}
        </span>
      </button>
    </Show>
  );
}
