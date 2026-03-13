import { createSignal, Show } from "solid-js";
import { TimerWidget } from "./TimerWidget";
import { WellnessStatus } from "./WellnessStatus";
import { DailyStats } from "./DailyStats";
import { TodayEvents } from "./TodayEvents";
import { WaterTracker } from "./WaterTracker";
import { FruitVegTracker } from "./FruitVegTracker";
import { StatsView } from "./StatsView";
import { Button } from "../common/Button";

export function DashboardView() {
  const [showStats, setShowStats] = createSignal(false);

  const today = () => {
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <Show when={!showStats()} fallback={<StatsView onClose={() => setShowStats(false)} />}>
      <div style={{ padding: "24px", height: "100%", "overflow-y": "auto" }}>
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px", "max-width": "900px" }}>
          <h2 style={{
            margin: "0",
            "font-size": "20px",
            "font-weight": "600",
            color: "var(--text-primary)",
            "text-transform": "capitalize",
          }}>
            {today()}
          </h2>
          <Button variant="secondary" size="sm" onClick={() => setShowStats(true)}>
            Statistiques
          </Button>
        </div>

        <div style={{
          display: "grid",
          "grid-template-columns": "1fr 1fr",
          gap: "16px",
          "max-width": "900px",
        }}>
          <TimerWidget />
          <DailyStats />
          <WaterTracker />
          <FruitVegTracker />
          <TodayEvents />
          <WellnessStatus />
        </div>
      </div>
    </Show>
  );
}
