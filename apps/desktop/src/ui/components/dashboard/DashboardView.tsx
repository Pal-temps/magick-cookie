import { createSignal, Show } from "solid-js";
import { TimerWidget } from "./TimerWidget";
import { WellnessStatus } from "./WellnessStatus";
import { DailyStats } from "./DailyStats";
import { TodayEvents } from "./TodayEvents";
import { WaterTracker } from "./WaterTracker";
import { FruitVegTracker } from "./FruitVegTracker";
import { StatsView } from "./StatsView";
import { DogWalkWidget } from "./DogWalkWidget";
import { Button } from "../common/Button";
import "../../styles/dashboard.css";

export function DashboardView() {
  const [showStats, setShowStats] = createSignal(false);

  const today = () => {
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <Show when={!showStats()} fallback={<StatsView onClose={() => setShowStats(false)} />}>
      <div class="dashboard-container" style={{ height: "100%" }}>
        <div class="dashboard-scroll">
          <div class="dashboard-header">
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

          <div class="dashboard-grid">
            <TimerWidget />
            <DailyStats />
            <WaterTracker />
            <FruitVegTracker />
            <DogWalkWidget />
            <TodayEvents />
            <WellnessStatus />
          </div>
        </div>
      </div>
    </Show>
  );
}
