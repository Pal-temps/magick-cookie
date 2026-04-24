import { createSignal, createMemo, Show, For, onMount } from "solid-js";
import { useStatsStore } from "../../../application/stores/statsStore";
import { useAnalyticsStore } from "../../../application/stores/analyticsStore";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";
import { TaskTimeChart } from "./TaskTimeChart";
import { CookieLoader } from "../common/CookieLoader";

type Tab = "timer" | "water" | "fruits_veggies";
type Preset = "week" | "month" | "year" | "custom";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  return `${m}min`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getPresetRange(preset: Preset): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  switch (preset) {
    case "week": {
      const from = new Date(to);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "month": {
      const from = new Date(to.getFullYear(), to.getMonth(), 1);
      return { from, to };
    }
    case "year": {
      const from = new Date(to.getFullYear(), 0, 1);
      return { from, to };
    }
    default:
      return { from: new Date(to.getFullYear(), to.getMonth(), 1), to };
  }
}

interface StatsViewProps {
  onClose: () => void;
}

export function StatsView(props: StatsViewProps) {
  const { timerDailyStats, wellnessRangeLogs, statsLoading, fetchTimerStats, fetchWellnessRange } = useStatsStore();
  const { fetchTimeByTask } = useAnalyticsStore();
  const { t, locale } = useT();

  function dayLabel(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(locale() === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short" });
  }

  const [tab, setTab] = createSignal<Tab>("timer");
  const [preset, setPreset] = createSignal<Preset>("week");
  const [customFrom, setCustomFrom] = createSignal(formatDate(getPresetRange("week").from));
  const [customTo, setCustomTo] = createSignal(formatDate(new Date()));

  const range = createMemo(() => {
    if (preset() === "custom") {
      return { from: new Date(customFrom()), to: new Date(customTo() + "T23:59:59") };
    }
    return getPresetRange(preset());
  });

  function loadData() {
    const r = range();
    if (tab() === "timer") {
      fetchTimerStats(r.from, r.to);
      fetchTimeByTask(r.from, r.to);
    } else {
      fetchWellnessRange(r.from, r.to, tab());
    }
  }

  onMount(loadData);

  // Reload on tab or preset change
  function switchTab(t: Tab) { setTab(t); setTimeout(loadData, 0); }
  function switchPreset(p: Preset) { setPreset(p); setTimeout(loadData, 0); }

  // Timer aggregated stats
  const timerSummary = createMemo(() => {
    const data = timerDailyStats();
    const totalSeconds = data.reduce((s, d) => s + d.totalSeconds, 0);
    const focusSeconds = data.reduce((s, d) => s + d.focusSeconds, 0);
    const sessions = data.reduce((s, d) => s + d.sessionCount, 0);
    const completed = data.reduce((s, d) => s + d.completedCount, 0);
    const cancelled = data.reduce((s, d) => s + d.cancelledCount, 0);
    const daysWorked = data.filter((d) => d.sessionCount > 0).length;
    const avgPerDay = daysWorked > 0 ? Math.round(focusSeconds / daysWorked) : 0;
    return { totalSeconds, focusSeconds, sessions, completed, cancelled, daysWorked, avgPerDay };
  });

  // Timer max bar value for chart
  const timerMaxSeconds = createMemo(() => {
    const max = Math.max(...timerDailyStats().map((d) => d.totalSeconds), 1);
    return max;
  });

  // Wellness aggregated stats
  const wellnessSummary = createMemo(() => {
    const data = wellnessRangeLogs();
    const total = data.reduce((s, d) => s + d.value, 0);
    const daysTracked = data.length;
    const avgPerDay = daysTracked > 0 ? Math.round(total / daysTracked) : 0;
    const daysGoalMet = data.filter((d) => d.value >= d.goal).length;
    const goal = data[0]?.goal ?? (tab() === "water" ? 2000 : 5);
    return { total, daysTracked, avgPerDay, daysGoalMet, goal };
  });

  const wellnessMaxValue = createMemo(() => {
    const max = Math.max(...wellnessRangeLogs().map((d) => d.value), 1);
    return max;
  });

  const cardStyle = {
    background: "var(--bg-elevated)",
    "border-radius": "var(--radius-md)",
    padding: "12px",
    "text-align": "center" as const,
  };

  const inputStyle = {
    padding: "4px 8px",
    "border-radius": "var(--radius-md)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    "font-size": "12px",
  };

  return (
    <div style={{ padding: "24px", height: "100%", "overflow-y": "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <h2 style={{ margin: "0", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
          {t("dashboard.stats")}
        </h2>
        <Button variant="ghost" size="sm" onClick={props.onClose}>{t("common.back")}</Button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", "margin-bottom": "16px" }}>
        <Button variant={tab() === "timer" ? "primary" : "secondary"} size="sm" onClick={() => switchTab("timer")}>
          {t("dashboard.pomodoroTimer")}
        </Button>
        <Button variant={tab() === "water" ? "primary" : "secondary"} size="sm" onClick={() => switchTab("water")}>
          {t("dashboard.water")}
        </Button>
        <Button variant={tab() === "fruits_veggies" ? "primary" : "secondary"} size="sm" onClick={() => switchTab("fruits_veggies")}>
          {t("dashboard.fruitsVeggies")}
        </Button>
      </div>

      {/* Preset selector */}
      <div style={{ display: "flex", gap: "4px", "align-items": "center", "margin-bottom": "16px", "flex-wrap": "wrap" }}>
        <Button variant={preset() === "week" ? "primary" : "secondary"} size="sm" onClick={() => switchPreset("week")}>{t("dashboard.last7days")}</Button>
        <Button variant={preset() === "month" ? "primary" : "secondary"} size="sm" onClick={() => switchPreset("month")}>{t("dashboard.thisMonth")}</Button>
        <Button variant={preset() === "year" ? "primary" : "secondary"} size="sm" onClick={() => switchPreset("year")}>{t("dashboard.thisYear")}</Button>
        <Button variant={preset() === "custom" ? "primary" : "secondary"} size="sm" onClick={() => switchPreset("custom")}>{t("dashboard.custom")}</Button>

        <Show when={preset() === "custom"}>
          <div style={{ display: "flex", gap: "6px", "align-items": "center", "margin-left": "8px" }}>
            <input type="date" value={customFrom()} onInput={(e) => setCustomFrom(e.target.value)} style={inputStyle} />
            <span style={{ color: "var(--text-muted)", "font-size": "12px" }}>a</span>
            <input type="date" value={customTo()} onInput={(e) => setCustomTo(e.target.value)} style={inputStyle} />
            <Button variant="primary" size="sm" onClick={loadData}>OK</Button>
          </div>
        </Show>
      </div>

      <Show when={statsLoading()}>
        <CookieLoader message={t("common.loading")} />
      </Show>

      {/* Timer stats */}
      <Show when={tab() === "timer" && !statsLoading()}>
        <div style={{ display: "grid", "grid-template-columns": "repeat(4, 1fr)", gap: "12px", "margin-bottom": "24px" }}>
          <div style={cardStyle}>
            <div style={{ "font-size": "22px", "font-weight": "700", color: "var(--accent-primary)" }}>
              {formatDuration(timerSummary().focusSeconds)}
            </div>
            <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.focusTotal")}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ "font-size": "22px", "font-weight": "700", color: "var(--accent-primary)" }}>
              {timerSummary().sessions}
            </div>
            <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.sessionsLabel")}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ "font-size": "22px", "font-weight": "700", color: "var(--accent-primary)" }}>
              {timerSummary().daysWorked}
            </div>
            <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.activeDays")}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ "font-size": "22px", "font-weight": "700", color: "var(--accent-primary)" }}>
              {formatDuration(timerSummary().avgPerDay)}
            </div>
            <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.avgPerDay")}</div>
          </div>
        </div>

        {/* Completed vs cancelled */}
        <div style={{ display: "flex", gap: "12px", "margin-bottom": "24px" }}>
          <div style={{ ...cardStyle, flex: "1", background: "rgba(0, 184, 148, 0.1)" }}>
            <span style={{ "font-size": "16px", "font-weight": "600", color: "#00b894" }}>{timerSummary().completed}</span>
            <span style={{ "font-size": "11px", color: "var(--text-muted)", "margin-left": "6px" }}>{t("dashboard.completed")}</span>
          </div>
          <div style={{ ...cardStyle, flex: "1", background: "rgba(214, 48, 49, 0.1)" }}>
            <span style={{ "font-size": "16px", "font-weight": "600", color: "#d63031" }}>{timerSummary().cancelled}</span>
            <span style={{ "font-size": "11px", color: "var(--text-muted)", "margin-left": "6px" }}>{t("dashboard.cancelled")}</span>
          </div>
        </div>

        {/* Bar chart */}
        <h3 style={{ margin: "0 0 12px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
          {t("dashboard.focusPerDay")}
        </h3>
        <div style={{ display: "flex", gap: "2px", "align-items": "flex-end", height: "160px", padding: "0 0 24px" }}>
          <For each={timerDailyStats()}>
            {(day) => {
              const pct = () => Math.max(2, (day.totalSeconds / timerMaxSeconds()) * 100);
              return (
                <div style={{ flex: "1", display: "flex", "flex-direction": "column", "align-items": "center", gap: "4px" }}>
                  <div style={{ "font-size": "9px", color: "var(--text-muted)" }}>
                    {day.totalSeconds > 0 ? formatDuration(day.totalSeconds) : ""}
                  </div>
                  <div style={{
                    width: "100%",
                    "max-width": "32px",
                    height: `${pct()}%`,
                    background: "var(--accent-primary)",
                    "border-radius": "var(--radius-sm) var(--radius-sm) 0 0",
                    "min-height": day.totalSeconds > 0 ? "4px" : "0",
                    transition: "height 0.3s ease",
                  }} />
                  <div style={{ "font-size": "9px", color: "var(--text-muted)", "white-space": "nowrap" }}>
                    {dayLabel(day.date)}
                  </div>
                </div>
              );
            }}
          </For>
        </div>
        <Show when={timerDailyStats().length === 0}>
          <div style={{ color: "var(--text-muted)", "font-size": "12px", "text-align": "center", padding: "20px" }}>
            {t("dashboard.noSessionPeriod")}
          </div>
        </Show>

        <TaskTimeChart />
      </Show>

      {/* Wellness stats (water / fruits) */}
      <Show when={tab() !== "timer" && !statsLoading()}>
        {(() => {
          const formatVal = (v: number) => tab() === "water" ? `${(v / 1000).toFixed(1)}L` : `${v}`;

          return (
            <>
              <div style={{ display: "grid", "grid-template-columns": "repeat(4, 1fr)", gap: "12px", "margin-bottom": "24px" }}>
                <div style={cardStyle}>
                  <div style={{ "font-size": "22px", "font-weight": "700", color: "var(--accent-primary)" }}>
                    {formatVal(wellnessSummary().total)}
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.total")}</div>
                </div>
                <div style={cardStyle}>
                  <div style={{ "font-size": "22px", "font-weight": "700", color: "var(--accent-primary)" }}>
                    {formatVal(wellnessSummary().avgPerDay)}
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.avgPerDay")}</div>
                </div>
                <div style={cardStyle}>
                  <div style={{ "font-size": "22px", "font-weight": "700", color: "#00b894" }}>
                    {wellnessSummary().daysGoalMet}
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.goalReached")}</div>
                </div>
                <div style={cardStyle}>
                  <div style={{ "font-size": "22px", "font-weight": "700", color: "var(--accent-primary)" }}>
                    {wellnessSummary().daysTracked}
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.daysTracked")}</div>
                </div>
              </div>

              {/* Bar chart */}
              <h3 style={{ margin: "0 0 12px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
                {tab() === "water" ? t("dashboard.waterPerDay") : t("dashboard.portionsPerDay")}
              </h3>
              <div style={{ display: "flex", gap: "2px", "align-items": "flex-end", height: "160px", padding: "0 0 24px" }}>
                <For each={wellnessRangeLogs()}>
                  {(log) => {
                    const pct = () => Math.max(2, (log.value / wellnessMaxValue()) * 100);
                    const goalMet = () => log.value >= log.goal;
                    return (
                      <div style={{ flex: "1", display: "flex", "flex-direction": "column", "align-items": "center", gap: "4px" }}>
                        <div style={{ "font-size": "9px", color: "var(--text-muted)" }}>
                          {log.value > 0 ? (tab() === "water" ? `${(log.value / 1000).toFixed(1)}L` : `${log.value}`) : ""}
                        </div>
                        <div style={{
                          width: "100%",
                          "max-width": "32px",
                          height: `${pct()}%`,
                          background: goalMet() ? "#00b894" : "var(--accent-primary)",
                          "border-radius": "var(--radius-sm) var(--radius-sm) 0 0",
                          "min-height": log.value > 0 ? "4px" : "0",
                          transition: "height 0.3s ease",
                        }} />
                        <div style={{ "font-size": "9px", color: "var(--text-muted)", "white-space": "nowrap" }}>
                          {dayLabel(log.date)}
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
              <Show when={wellnessRangeLogs().length === 0}>
                <div style={{ color: "var(--text-muted)", "font-size": "12px", "text-align": "center", padding: "20px" }}>
                  {t("dashboard.noDataPeriod")}
                </div>
              </Show>

              <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "8px" }}>
                {t("dashboard.greenBarsHint").replace("{goal}", tab() === "water" ? `${(wellnessSummary().goal / 1000).toFixed(1)}L` : `${wellnessSummary().goal} ${t("dashboard.portionsLabel")}`)}
              </div>
            </>
          );
        })()}
      </Show>
    </div>
  );
}
