import { Show, For, type Component } from "solid-js";
import { useDashboardStore, type WidgetId } from "../../../application/stores/dashboardStore";
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
  label: string;
  component: Component;
}

const ALL_WIDGETS: WidgetDef[] = [
  { id: "timer", label: "Timer", component: TimerWidget },
  { id: "daily-stats", label: "Stats du jour", component: DailyStats },
  { id: "water", label: "Eau", component: WaterTracker },
  { id: "fruits", label: "Fruits & Legumes", component: FruitVegTracker },
  { id: "dog-walk", label: "Balade", component: DogWalkWidget },
  { id: "today-events", label: "Evenements", component: TodayEvents },
  { id: "wellness", label: "Bien-etre", component: WellnessStatus },
  { id: "alarms", label: "Alarmes", component: AlarmWidget },
  { id: "streak", label: "Streak", component: StreakWidget },
  { id: "github-prs", label: "GitHub PRs", component: GitHubWidget },
  { id: "vps", label: "VPS", component: VpsWidget },
  { id: "analytics", label: "Vue d'ensemble", component: AnalyticsWidget },
];

const WIDGET_MAP = new Map<WidgetId, WidgetDef>(ALL_WIDGETS.map((w) => [w.id, w]));

export function DashboardSidebarContent() {
  const { pinnedWidgets, unpinWidget } = useDashboardStore();

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
        Widgets epingles
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
            <p>Aucun widget epingle</p>
            <p style={{ "margin-top": "4px", "font-size": "11px" }}>
              Cliquez sur l'icone epingle d'un widget dans le dashboard pour l'afficher ici.
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
                  title={def.label}
                  defaultOpen={true}
                  badge={
                    <button
                      onClick={(e) => { e.stopPropagation(); unpinWidget(widgetId); }}
                      title="Retirer de la sidebar"
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
