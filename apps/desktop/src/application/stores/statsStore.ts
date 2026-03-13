import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import type { DailyTimerStats } from "../../domain/models/TimerSession";
import type { WellnessLog } from "../../domain/models/WellnessLog";

const [timerDailyStats, setTimerDailyStats] = createSignal<DailyTimerStats[]>([]);
const [wellnessRangeLogs, setWellnessRangeLogs] = createSignal<WellnessLog[]>([]);
const [statsLoading, setStatsLoading] = createSignal(false);

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useStatsStore() {
  async function fetchTimerStats(from: Date, to: Date) {
    setStatsLoading(true);
    try {
      const data = await api.get<DailyTimerStats[]>(
        `/timer-sessions/stats/daily?from=${from.toISOString()}&to=${to.toISOString()}`
      );
      setTimerDailyStats(data);
    } catch (e) {
      console.error("Failed to fetch timer daily stats:", e);
    } finally {
      setStatsLoading(false);
    }
  }

  async function fetchWellnessRange(from: Date, to: Date, type?: string) {
    setStatsLoading(true);
    try {
      let url = `/wellness-logs/range?from=${formatDate(from)}&to=${formatDate(to)}`;
      if (type) url += `&type=${type}`;
      const data = await api.get<WellnessLog[]>(url);
      setWellnessRangeLogs(data);
    } catch (e) {
      console.error("Failed to fetch wellness range:", e);
    } finally {
      setStatsLoading(false);
    }
  }

  async function fetchAll(from: Date, to: Date, wellnessType?: string) {
    setStatsLoading(true);
    try {
      await Promise.all([
        fetchTimerStats(from, to),
        fetchWellnessRange(from, to, wellnessType),
      ]);
    } finally {
      setStatsLoading(false);
    }
  }

  return {
    timerDailyStats,
    wellnessRangeLogs,
    statsLoading,
    fetchTimerStats,
    fetchWellnessRange,
    fetchAll,
  };
}
