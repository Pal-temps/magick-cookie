import { Show } from "solid-js";
import { useViewStore } from "../../../application/stores/viewStore";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { DashboardView } from "../dashboard/DashboardView";

export function CalendarGrid() {
  const { viewMode } = useViewStore();

  return (
    <div style={{ flex: "1", overflow: "auto" }}>
      <Show when={viewMode() === "dashboard"}><DashboardView /></Show>
      <Show when={viewMode() === "month"}><MonthView /></Show>
      <Show when={viewMode() === "week"}><WeekView /></Show>
      <Show when={viewMode() === "day"}><DayView /></Show>
    </div>
  );
}
