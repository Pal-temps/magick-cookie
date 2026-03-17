import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import { getActiveTemplate } from "../brief/briefTemplates";

export interface BriefRawData {
  yesterday: {
    timerSessions: { label: string | null; actualSeconds: number; completed: boolean }[];
    totalFocusSeconds: number;
    events: { title: string; startAt: string }[];
    triagedTasks: { title: string; status: string }[];
  };
  today: {
    events: { title: string; startAt: string }[];
    priorityTasks: { title: string; status: string; source: string }[];
    unreadEmails: number;
  };
  blockers: {
    staleTasks: { title: string; daysSinceTriaged: number }[];
    overdueEvents: { title: string; endAt: string }[];
  };
}

export interface BriefResponse {
  date: string;
  rawData: BriefRawData;
  brief: string;
}

export interface AnalyticsOverview {
  period: { from: string; to: string };
  focus: { totalSeconds: number; sessionCount: number; completedCount: number; dailyStats: { date: string; totalSeconds: number }[] };
  triage: { byStatus: Record<string, number>; totalTriaged: number };
  wellness: { waterAvg: number; fruitAvg: number; daysTracked: number };
  email: { received: number; unread: number; dailyStats: { date: string; count: number }[] };
  events: { total: number; dailyStats: { date: string; count: number }[] };
  dogWalk: { totalWalks: number; totalSeconds: number; dailyStats: { date: string; walkCount: number }[] };
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  last30Days: { date: string; totalSeconds: number }[];
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

export interface TaskTimeEntry {
  taskId: string | null;
  taskTitle: string | null;
  totalSeconds: number;
  sessionCount: number;
}

export interface ProductivityPatterns {
  hourlyDistribution: { hour: number; avgMinutes: number }[];
  weekdayDistribution: { day: number; dayName: string; avgMinutes: number }[];
  bestHours: number[];
  bestDays: string[];
  weeklyTrend: number | null;
}

export interface TimesheetRow {
  taskId: string | null;
  taskTitle: string | null;
  days: Record<string, number>;
  totalSeconds: number;
}

export interface TimesheetData {
  weekStart: string;
  weekEnd: string;
  dates: string[];
  rows: TimesheetRow[];
  dailyTotals: Record<string, number>;
  grandTotal: number;
}

const [timesheet, setTimesheet] = createSignal<TimesheetData | null>(null);
const [timesheetLoading, setTimesheetLoading] = createSignal(false);
const [patterns, setPatterns] = createSignal<ProductivityPatterns | null>(null);
const [patternsLoading, setPatternsLoading] = createSignal(false);
const [overview, setOverview] = createSignal<AnalyticsOverview | null>(null);
const [weeklyReview, setWeeklyReview] = createSignal<WeeklyReview | null>(null);
const [analyticsLoading, setAnalyticsLoading] = createSignal(false);
const [weeklyLoading, setWeeklyLoading] = createSignal(false);
const [streak, setStreak] = createSignal<StreakData | null>(null);
const [brief, setBrief] = createSignal<{ brief: string; rawData: BriefRawData } | null>(null);
const [briefLoading, setBriefLoading] = createSignal(false);
const [timeByTask, setTimeByTask] = createSignal<TaskTimeEntry[]>([]);

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

  async function fetchStreak() {
    try {
      const data = await api.get<StreakData>("/analytics/streak");
      setStreak(data);
    } catch (e) {
      console.error("Failed to fetch streak:", e);
    }
  }

  async function fetchTimeByTask(from: Date, to: Date) {
    try {
      const data = await api.get<TaskTimeEntry[]>(
        `/analytics/time-by-task?from=${formatDate(from)}&to=${formatDate(to)}`,
      );
      setTimeByTask(data);
    } catch (e) {
      console.error("Failed to fetch time by task:", e);
    }
  }

  async function fetchTimesheet(week: string) {
    setTimesheetLoading(true);
    try {
      const data = await api.get<TimesheetData>(
        `/analytics/timesheet?week=${week}`,
      );
      setTimesheet(data);
    } catch (e) {
      console.error("Failed to fetch timesheet:", e);
    } finally {
      setTimesheetLoading(false);
    }
  }

  async function fetchPatterns(from: Date, to: Date) {
    setPatternsLoading(true);
    try {
      const data = await api.get<ProductivityPatterns>(
        `/analytics/patterns?from=${formatDate(from)}&to=${formatDate(to)}`,
      );
      setPatterns(data);
    } catch (e) {
      console.error("Failed to fetch patterns:", e);
    } finally {
      setPatternsLoading(false);
    }
  }

  async function fetchBrief(date?: string) {
    setBriefLoading(true);
    try {
      const template = getActiveTemplate();
      const body: { date?: string; prompt?: string } = { prompt: template.prompt };
      if (date) body.date = date;
      const data = await api.post<BriefResponse>("/brief/generate", body);
      setBrief(data);
    } catch (e) {
      console.error("Failed to fetch brief:", e);
    } finally {
      setBriefLoading(false);
    }
  }

  return {
    overview,
    weeklyReview,
    streak,
    analyticsLoading,
    weeklyLoading,
    brief,
    briefLoading,
    timeByTask,
    patterns,
    patternsLoading,
    timesheet,
    timesheetLoading,
    fetchOverview,
    fetchWeeklyReview,
    fetchStreak,
    fetchBrief,
    fetchTimeByTask,
    fetchPatterns,
    fetchTimesheet,
  };
}
