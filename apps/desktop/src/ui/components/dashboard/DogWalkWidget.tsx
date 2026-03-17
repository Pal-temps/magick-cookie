import { Show, onMount } from "solid-js";
import { useDogWalkStore } from "../../../application/stores/dogWalkStore";
import { Button } from "../common/Button";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function DogWalkWidget() {
  const { activeWalk, elapsedSeconds, todayStats, fetchActive, fetchTodayStats, startWalk, stopWalk } = useDogWalkStore();

  onMount(() => {
    fetchActive();
    fetchTodayStats();
  });

  const isWalking = () => !!activeWalk();

  const handleToggle = async () => {
    if (isWalking()) {
      await stopWalk();
    } else {
      await startWalk();
    }
  };

  return (
    <div>

      {/* Chrono display */}
      <div style={{
        "text-align": "center",
        "margin-bottom": "16px",
      }}>
        <span style={{
          "font-size": isWalking() ? "36px" : "28px",
          "font-weight": "700",
          "font-variant-numeric": "tabular-nums",
          color: isWalking() ? "var(--cal-green)" : "var(--text-muted)",
          transition: "all 0.2s ease",
        }}>
          {formatElapsed(elapsedSeconds())}
        </span>
      </div>

      {/* Start/Stop button */}
      <Button
        variant={isWalking() ? "danger" : "primary"}
        onClick={handleToggle}
        style={{ width: "100%", "font-size": "14px" }}
      >
        {isWalking() ? "Arreter la balade" : "Demarrer une balade"}
      </Button>

      {/* Today stats */}
      <Show when={todayStats().walkCount > 0}>
        <div style={{
          "margin-top": "12px",
          "padding-top": "12px",
          "border-top": "1px solid var(--border-color)",
          display: "flex",
          "justify-content": "space-between",
          "font-size": "12px",
          color: "var(--text-secondary)",
        }}>
          <span>{todayStats().walkCount} balade{todayStats().walkCount > 1 ? "s" : ""} aujourd'hui</span>
          <span>{formatElapsed(todayStats().totalSeconds)} total</span>
        </div>
      </Show>
    </div>
  );
}
