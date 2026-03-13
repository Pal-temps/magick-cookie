import { TimerWidget } from "./TimerWidget";
import { WellnessStatus } from "./WellnessStatus";
import { DailyStats } from "./DailyStats";
import { TodayEvents } from "./TodayEvents";
import { WaterTracker } from "./WaterTracker";
import { FruitVegTracker } from "./FruitVegTracker";

export function DashboardView() {
  const today = () => {
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <div style={{ padding: "24px", height: "100%", "overflow-y": "auto" }}>
      <h2 style={{
        margin: "0 0 20px",
        "font-size": "20px",
        "font-weight": "600",
        color: "var(--text-primary)",
        "text-transform": "capitalize",
      }}>
        {today()}
      </h2>

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
  );
}
