import { Show, For, type Component } from "solid-js";
import { useDashboardStore, type WidgetId } from "../../../application/stores/dashboardStore";
import { useT } from "../../../i18n/context";
import { TimerWidget } from "../dashboard/TimerWidget";
import { WellnessStatus } from "../dashboard/WellnessStatus";
import { DailyStats } from "../dashboard/DailyStats";
import { TodayEvents } from "../dashboard/TodayEvents";
import { WaterTracker } from "../dashboard/WaterTracker";
import { FruitVegTracker } from "../dashboard/FruitVegTracker";
import { DogWalkWidget } from "../dashboard/DogWalkWidget";
import { AnalyticsWidget } from "../dashboard/AnalyticsWidget";
import { GitHubWidget } from "../dashboard/GitHubWidget";
import { VpsWidget } from "../dashboard/VpsWidget";
import { StreakWidget } from "../dashboard/StreakWidget";
import { AlarmWidget } from "../dashboard/AlarmWidget";
import { CollapsibleSection } from "../common/CollapsibleSection";

interface WidgetDef {
  id: WidgetId;
  labelKey: string;
  component: Component;
}

const ALL_WIDGETS: WidgetDef[] = [
  { id: "timer", labelKey: "dashboard.timer", component: TimerWidget },
  { id: "daily-stats", labelKey: "dashboard.dailyStats", component: DailyStats },
  { id: "water", labelKey: "dashboard.water", component: WaterTracker },
  { id: "fruits", labelKey: "dashboard.fruitsVeg", component: FruitVegTracker },
  { id: "dog-walk", labelKey: "dashboard.walk", component: DogWalkWidget },
  { id: "today-events", labelKey: "dashboard.events", component: TodayEvents },
  { id: "wellness", labelKey: "dashboard.wellness", component: WellnessStatus },
  { id: "alarms", labelKey: "dashboard.alarm", component: AlarmWidget },
  { id: "streak", labelKey: "dashboard.streak", component: StreakWidget },
  { id: "github-prs", labelKey: "dashboard.githubPrs", component: GitHubWidget },
  { id: "vps", labelKey: "dashboard.vps", component: VpsWidget },
  { id: "analytics", labelKey: "dashboard.overview", component: AnalyticsWidget },
];

const WIDGET_MAP = new Map<WidgetId, WidgetDef>(ALL_WIDGETS.map((w) => [w.id, w]));

export function DashboardSidebarContent() {
  const { pinnedWidgets, unpinWidget } = useDashboardStore();
  const { t } = useT();

  return (
    <div style={{ display: "flex", "flex-direction": "column", flex: "1", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "10px 12px",
        "font-size": "11px",
        "font-weight": "600",
        color: "var(--text-muted)",
        "text-transform": "uppercase",
        "letter-spacing": "0.5px",
        "border-bottom": "1px solid var(--border-color)",
      }}>
        {t("dashboard.pinnedWidgets")}
      </div>

      <div style={{ flex: "1", "overflow-y": "auto" }}>
        <Show when={pinnedWidgets().length > 0} fallback={
          <div style={{
            padding: "24px 16px",
            "text-align": "center",
            color: "var(--text-muted)",
            "font-size": "12px",
            "line-height": "1.5",
          }}>
            <div style={{ "font-size": "24px", "margin-bottom": "8px", opacity: "0.5" }}>&#128204;</div>
            <p>{t("dashboard.noPinnedWidget")}</p>
            <p style={{ "margin-top": "4px", "font-size": "11px" }}>
              {t("dashboard.pinHint")}
            </p>
          </div>
        }>
          <For each={pinnedWidgets()}>
            {(widgetId) => {
              const def = WIDGET_MAP.get(widgetId);
              if (!def) return null;
              const Comp = def.component;
              return (
                <CollapsibleSection
                  title={t(def.labelKey)}
                  defaultOpen={true}
                  badge={
                    <button
                      onClick={(e) => { e.stopPropagation(); unpinWidget(widgetId); }}
                      title={t("dashboard.removeFromSidebar")}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--text-muted)", "font-size": "11px", padding: "0 2px",
                        "line-height": "1",
                      }}
                    >&#10005;</button>
                  }
                >
                  <div style={{ padding: "0 4px" }}>
                    <Comp />
                  </div>
                </CollapsibleSection>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
}
