import { createSignal, onMount, Show } from "solid-js";
import { useAnalyticsStore } from "../../../application/stores/analyticsStore";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";
import { useT } from "../../../i18n/context";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  return `${m}min`;
}

function getCurrentWeek(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dayOfYear = Math.floor((now.getTime() - jan4.getTime()) / 86400000);
  const weekNum = Math.ceil((dayOfYear + jan4.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function DeltaBadge(props: { value: number | null; label: string }) {
  if (props.value === null) return null;

  const color = props.value > 0 ? "#00b894" : props.value < 0 ? "#d63031" : "var(--text-muted)";
  const arrow = props.value > 0 ? "\u2191" : props.value < 0 ? "\u2193" : "=";

  return (
    <div style={{
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      padding: "8px 12px",
      background: "var(--bg-elevated)",
      "border-radius": "var(--radius-md)",
      "margin-bottom": "6px",
    }}>
      <span style={{ "font-size": "13px", color: "var(--text-primary)" }}>{props.label}</span>
      <span style={{ "font-size": "13px", "font-weight": "600", color }}>
        {arrow} {Math.abs(props.value)}%
      </span>
    </div>
  );
}

interface WeeklyReviewProps {
  onClose: () => void;
}

export function WeeklyReview(props: WeeklyReviewProps) {
  const { weeklyReview, weeklyLoading, fetchWeeklyReview } = useAnalyticsStore();
  const { t } = useT();
  const [week, setWeek] = createSignal(getCurrentWeek());

  onMount(() => fetchWeeklyReview(week()));

  function loadWeek(w: string) {
    setWeek(w);
    fetchWeeklyReview(w);
  }

  function prevWeek() {
    const match = week().match(/^(\d{4})-W(\d+)$/);
    if (!match) return;
    let y = parseInt(match[1], 10);
    let w = parseInt(match[2], 10) - 1;
    if (w < 1) { y--; w = 52; }
    loadWeek(`${y}-W${String(w).padStart(2, "0")}`);
  }

  function nextWeek() {
    const match = week().match(/^(\d{4})-W(\d+)$/);
    if (!match) return;
    let y = parseInt(match[1], 10);
    let w = parseInt(match[2], 10) + 1;
    if (w > 52) { y++; w = 1; }
    loadWeek(`${y}-W${String(w).padStart(2, "0")}`);
  }

  return (
    <div style={{ padding: "24px", height: "100%", "overflow-y": "auto" }}>
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <h2 style={{ margin: "0", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
          {t("dashboard.weeklyReview")}
        </h2>
        <Button variant="ghost" size="sm" onClick={props.onClose}>{t("common.back")}</Button>
      </div>

      <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "20px" }}>
        <Button variant="ghost" size="sm" onClick={prevWeek}>&lt;</Button>
        <span style={{ "font-size": "16px", "font-weight": "600", color: "var(--text-primary)", "min-width": "100px", "text-align": "center" }}>
          {week()}
        </span>
        <Button variant="ghost" size="sm" onClick={nextWeek}>&gt;</Button>
      </div>

      <Show when={weeklyLoading()}>
        <CookieLoader message={t("common.loading")} />
      </Show>

      <Show when={!weeklyLoading() && weeklyReview()}>
        {(review) => (
          <>
            {/* Current week summary */}
            <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "10px", "margin-bottom": "24px" }}>
              <div style={{ background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", padding: "14px", "text-align": "center" }}>
                <div style={{ "font-size": "24px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {formatDuration(review().current.focus.totalSeconds)}
                </div>
                <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.focusTotal")}</div>
              </div>
              <div style={{ background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", padding: "14px", "text-align": "center" }}>
                <div style={{ "font-size": "24px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {review().current.focus.sessionCount}
                </div>
                <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.sessions")}</div>
              </div>
              <div style={{ background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", padding: "14px", "text-align": "center" }}>
                <div style={{ "font-size": "24px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {review().current.email.received}
                </div>
                <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>{t("dashboard.emailsReceived")}</div>
              </div>
            </div>

            {/* Deltas */}
            <h3 style={{ "font-size": "14px", "font-weight": "600", color: "var(--text-primary)", margin: "0 0 12px" }}>
              {t("dashboard.vsPreviousWeek")}
            </h3>
            <DeltaBadge value={review().deltas.focusSeconds} label={t("dashboard.focusTime")} />
            <DeltaBadge value={review().deltas.sessionCount} label={t("dashboard.sessions")} />
            <DeltaBadge value={review().deltas.emailReceived} label={t("dashboard.emailsReceived")} />
            <DeltaBadge value={review().deltas.eventsTotal} label={t("dashboard.events")} />
            <DeltaBadge value={review().deltas.totalFluxed} label={t("dashboard.fluxItems")} />
            <DeltaBadge value={review().deltas.dogWalks} label={t("dashboard.walks")} />

            {/* Wellness */}
            <h3 style={{ "font-size": "14px", "font-weight": "600", color: "var(--text-primary)", margin: "20px 0 12px" }}>
              {t("dashboard.wellness")}
            </h3>
            <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "10px" }}>
              <div style={{ background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", padding: "12px", "text-align": "center" }}>
                <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {review().current.wellness.waterAvg}ml
                </div>
                <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>{t("dashboard.waterAvgDay")}</div>
              </div>
              <div style={{ background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", padding: "12px", "text-align": "center" }}>
                <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {review().current.wellness.fruitAvg}
                </div>
                <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>{t("dashboard.fruitsAvgDay")}</div>
              </div>
              <div style={{ background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", padding: "12px", "text-align": "center" }}>
                <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {review().current.wellness.daysTracked}
                </div>
                <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>{t("dashboard.daysTracked")}</div>
              </div>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
