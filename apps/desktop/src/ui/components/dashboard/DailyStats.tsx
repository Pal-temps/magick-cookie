import { useTimerStore } from "../../../application/stores/timerStore";
import { useT } from "../../../i18n/context";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export function DailyStats() {
  const { todayStats } = useTimerStore();
  const { t } = useT();

  return (
    <div class="daily-stats">
      <div class="daily-stats-grid">
        <div class="daily-stats-cell">
          <div class="daily-stats-value">
            {formatDuration(todayStats().totalSeconds)}
          </div>
          <div class="daily-stats-label">
            {t("dashboard.focus")}
          </div>
        </div>
        <div class="daily-stats-cell">
          <div class="daily-stats-value">
            {todayStats().sessionCount}
          </div>
          <div class="daily-stats-label">
            {t("dashboard.sessions")}
          </div>
        </div>
      </div>
    </div>
  );
}
