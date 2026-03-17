import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";

export interface AnalyticsOverview {
  period: { from: string; to: string };
  focus: { totalSeconds: number; sessionCount: number; completedCount: number; dailyStats: { date: string; totalSeconds: number }[] };
  triage: { byStatus: Record<string, number>; totalTriaged: number };
  wellness: { waterAvg: number; fruitAvg: number; daysTracked: number };
  email: { received: number; unread: number; dailyStats: { date: string; count: number }[] };
  events: { total: number; dailyStats: { date: string; count: number }[] };
  dogWalk: { totalWalks: number; totalSeconds: number; dailyStats: { date: string; walkCount: number }[] };
}

export interface WeeklyReview {
  week: string;
  current: AnalyticsOverview;
  previous: AnalyticsOverview;
  deltas: {
    focusSeconds: number | null;
    sessionCount: number | null;
    totalTriaged: number | null;
    emailReceived: number | null;
    eventsTotal: number | null;
    dogWalks: number | null;
  };
}

const [overview, setOverview] = createSignal<AnalyticsOverview | null>(null);
const [weeklyReview, setWeeklyReview] = createSignal<WeeklyReview | null>(null);
const [analyticsLoading, setAnalyticsLoading] = createSignal(false);
const [weeklyLoading, setWeeklyLoading] = createSignal(false);

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useAnalyticsStore() {
  async function fetchOverview(from: Date, to: Date) {
    setAnalyticsLoading(true);
    try {
      const data = await api.get<AnalyticsOverview>(
        `/analytics?from=${formatDate(from)}&to=${formatDate(to)}`,
      );
      setOverview(data);
    } catch (e) {
      console.error("Failed to fetch analytics:", e);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function fetchWeeklyReview(week: string) {
    setWeeklyLoading(true);
    try {
      const data = await api.get<WeeklyReview>(
        `/analytics/weekly-review?week=${week}`,
      );
      setWeeklyReview(data);
    } catch (e) {
      console.error("Failed to fetch weekly review:", e);
    } finally {
      setWeeklyLoading(false);
    }
  }

  return {
    overview,
    weeklyReview,
    analyticsLoading,
    weeklyLoading,
    fetchOverview,
    fetchWeeklyReview,
  };
}
