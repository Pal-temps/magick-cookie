import { createSignal, createEffect, Show, For, onMount } from "solid-js";
import { useAnalyticsStore } from "../../../application/stores/analyticsStore";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";

interface TimesheetViewProps {
  onClose: () => void;
}

const DAY_LABELS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDuration(seconds: number): string {
  if (seconds === 0) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m > 0 ? `${m}min` : ""}`.trim();
  return `${m}min`;
}

function getCurrentISOWeek(): string {
  const now = new Date();
  // ISO week: week containing Thursday
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function offsetWeek(weekStr: string, delta: number): string {
  const match = weekStr.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return weekStr;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // Approximate: get Monday of this week, add delta*7 days, recalculate
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);

  const monday = new Date(mondayOfWeek1);
  monday.setDate(monday.getDate() + (week - 1) * 7 + delta * 7);

  // Recalculate ISO week from the target monday
  const d = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
  const dn = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dn);
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const wn = Math.ceil(((d.getTime() - ys.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(wn).padStart(2, "0")}`;
}

function cellBg(seconds: number, maxSeconds: number): string {
  if (seconds === 0 || maxSeconds === 0) return "transparent";
  const intensity = Math.min(1, seconds / maxSeconds);
  const alpha = 0.1 + intensity * 0.4;
  return `rgba(59, 130, 246, ${alpha})`;
}

export function TimesheetView(props: TimesheetViewProps) {
  const { timesheet, timesheetLoading, fetchTimesheet } = useAnalyticsStore();
  const { t, locale } = useT();
  const dayLabels = () => locale() === "fr" ? DAY_LABELS_FR : DAY_LABELS_EN;
  const [week, setWeek] = createSignal(getCurrentISOWeek());

  onMount(() => fetchTimesheet(week()));

  createEffect(() => {
    fetchTimesheet(week());
  });

  const maxCellSeconds = () => {
    const data = timesheet();
    if (!data) return 3600;
    let max = 0;
    for (const row of data.rows) {
      for (const val of Object.values(row.days)) {
        if (val > max) max = val;
      }
    }
    return max || 3600;
  };

  const cellStyle = {
    padding: "6px 8px",
    "font-size": "12px",
    "text-align": "center" as const,
    "border-bottom": "1px solid var(--border-color)",
    "border-right": "1px solid var(--border-color)",
  };

  const headerStyle = {
    ...cellStyle,
    "font-weight": "600" as const,
    color: "var(--text-primary)",
    background: "var(--bg-elevated)",
  };

  return (
    <div style={{ padding: "24px", height: "100%", display: "flex", "flex-direction": "column" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <h2 style={{ margin: "0", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
          {t("dashboard.timesheet")}
        </h2>
        <Button variant="ghost" size="sm" onClick={props.onClose}>{t("common.back")}</Button>
      </div>

      {/* Week navigation */}
      <div style={{ display: "flex", "align-items": "center", gap: "12px", "margin-bottom": "16px" }}>
        <Button variant="secondary" size="sm" onClick={() => setWeek(offsetWeek(week(), -1))}>
          &larr; {t("dashboard.prevWeek")}
        </Button>
        <span style={{ "font-size": "14px", "font-weight": "500", color: "var(--text-primary)" }}>
          {week()}
        </span>
        <Button variant="secondary" size="sm" onClick={() => setWeek(offsetWeek(week(), 1))}>
          {t("dashboard.nextWeek")} &rarr;
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeek(getCurrentISOWeek())}>
          {t("common.today")}
        </Button>
      </div>

      {/* Content */}
      <div style={{ flex: "1", "overflow-y": "auto" }}>
        <Show when={timesheetLoading()}>
          <CookieLoader message={t("common.loading")} />
        </Show>

        <Show when={!timesheetLoading() && timesheet()}>
          {(data) => (
            <>
              {/* Summary cards */}
              <div style={{ display: "flex", gap: "12px", "margin-bottom": "20px" }}>
                <div style={{
                  background: "var(--bg-elevated)",
                  "border-radius": "var(--radius-md)",
                  padding: "12px",
                  "text-align": "center",
                  flex: "1",
                }}>
                  <div style={{ "font-size": "22px", "font-weight": "700", color: "var(--accent-primary)" }}>
                    {formatDuration(data().grandTotal)}
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.weekTotal")}</div>
                </div>
                <div style={{
                  background: "var(--bg-elevated)",
                  "border-radius": "var(--radius-md)",
                  padding: "12px",
                  "text-align": "center",
                  flex: "1",
                }}>
                  <div style={{ "font-size": "22px", "font-weight": "700", color: "var(--accent-primary)" }}>
                    {data().rows.length}
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.tasks")}</div>
                </div>
              </div>

              {/* Table */}
              <div style={{ "overflow-x": "auto", "border-radius": "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                <table style={{ width: "100%", "border-collapse": "collapse", "min-width": "600px" }}>
                  <thead>
                    <tr>
                      <th style={{ ...headerStyle, "text-align": "left", "min-width": "160px" }}>{t("dashboard.task")}</th>
                      <For each={data().dates}>
                        {(date, i) => (
                          <th style={headerStyle}>
                            <div>{dayLabels()[i()]}</div>
                            <div style={{ "font-size": "10px", "font-weight": "400", color: "var(--text-muted)" }}>
                              {date.slice(5)}
                            </div>
                          </th>
                        )}
                      </For>
                      <th style={headerStyle}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={data().rows}>
                      {(row) => (
                        <tr>
                          <td style={{ ...cellStyle, "text-align": "left", color: "var(--text-primary)", "font-weight": "500" }}>
                            {row.taskTitle || t("dashboard.noTask")}
                          </td>
                          <For each={data().dates}>
                            {(date) => {
                              const seconds = row.days[date] || 0;
                              return (
                                <td style={{
                                  ...cellStyle,
                                  color: seconds > 0 ? "var(--text-primary)" : "var(--text-muted)",
                                  background: cellBg(seconds, maxCellSeconds()),
                                }}>
                                  {formatDuration(seconds)}
                                </td>
                              );
                            }}
                          </For>
                          <td style={{ ...cellStyle, "font-weight": "600", color: "var(--text-primary)", background: "var(--bg-elevated)" }}>
                            {formatDuration(row.totalSeconds)}
                          </td>
                        </tr>
                      )}
                    </For>
                    {/* Total row */}
                    <tr>
                      <td style={{ ...cellStyle, "text-align": "left", "font-weight": "600", color: "var(--text-primary)", background: "var(--bg-elevated)" }}>
                        Total
                      </td>
                      <For each={data().dates}>
                        {(date) => {
                          const seconds = data().dailyTotals[date] || 0;
                          return (
                            <td style={{
                              ...cellStyle,
                              "font-weight": "600",
                              color: "var(--text-primary)",
                              background: "var(--bg-elevated)",
                            }}>
                              {formatDuration(seconds)}
                            </td>
                          );
                        }}
                      </For>
                      <td style={{
                        ...cellStyle,
                        "font-weight": "700",
                        color: "var(--accent-primary)",
                        background: "var(--bg-elevated)",
                      }}>
                        {formatDuration(data().grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Show when={data().rows.length === 0}>
                <div style={{ color: "var(--text-muted)", "font-size": "12px", "text-align": "center", padding: "20px" }}>
                  {t("dashboard.noFocusThisWeek")}
                </div>
              </Show>
            </>
          )}
        </Show>

        <Show when={!timesheetLoading() && !timesheet()}>
          <div style={{ color: "var(--text-muted)", "font-size": "13px", padding: "20px 0" }}>
            {t("dashboard.cannotLoadTimesheet")}
          </div>
        </Show>
      </div>
    </div>
  );
}
