import type { TimerSessionRepository, DailyTimerStats } from "../../domain/timer-session/timer-session.repository";
import type { DogWalkRepository } from "../../domain/dog-walk/dog-walk.repository";
import type { WellnessLogRepository } from "../../domain/wellness-log/wellness-log.repository";
import type { TriageRepository } from "../../domain/triage/triage.repository";
import type { EmailRepository } from "../../domain/email/email.repository";
import type { EventRepository } from "../../domain/event/event.repository";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { ProjectRepository } from "../../domain/project/project.repository";

export interface ProjectTimeEntry {
  projectId: string | null;
  projectName: string | null;
  color: string | null;
  totalSeconds: number;
  sessionCount: number;
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

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  last30Days: { date: string; totalSeconds: number }[];
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
  days: Record<string, number>; // { "2026-03-10": 3600, "2026-03-11": 1800 }
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

export class AnalyticsService {
  constructor(
    private timerRepo: TimerSessionRepository,
    private dogWalkRepo: DogWalkRepository,
    private wellnessLogRepo: WellnessLogRepository,
    private triageRepo: TriageRepository,
    private emailRepo: EmailRepository,
    private eventRepo: EventRepository,
    private taskRepo: TaskRepository,
    private projectRepo?: ProjectRepository,
  ) {}

  async getOverview(from: Date, to: Date): Promise<AnalyticsOverview> {
    const fromStr = formatDate(from);
    const toStr = formatDate(to);

    const [timerStats, dogWalkStats, wellnessWater, wellnessFruit, triageByStatus, triageCount, emailStats, eventStats] = await Promise.all([
      this.timerRepo.getDailyStats(from, to),
      this.dogWalkRepo.getDailyStats(from, to),
      this.wellnessLogRepo.findByRange(fromStr, toStr, "water"),
      this.wellnessLogRepo.findByRange(fromStr, toStr, "fruits_veggies"),
      this.triageRepo.countByStatus(),
      this.triageRepo.countByDateRange(from, to),
      this.emailRepo.countByDateRange(from, to),
      this.eventRepo.countByDateRange(from, to),
    ]);

    const totalFocusSeconds = timerStats.reduce((s, d) => s + d.totalSeconds, 0);
    const totalSessions = timerStats.reduce((s, d) => s + d.sessionCount, 0);
    const totalCompleted = timerStats.reduce((s, d) => s + d.completedCount, 0);

    const waterDays = wellnessWater.filter((l) => l.value > 0);
    const fruitDays = wellnessFruit.filter((l) => l.value > 0);
    const waterAvg = waterDays.length > 0 ? Math.round(waterDays.reduce((s, l) => s + l.value, 0) / waterDays.length) : 0;
    const fruitAvg = fruitDays.length > 0 ? Math.round(fruitDays.reduce((s, l) => s + l.value, 0) / fruitDays.length * 10) / 10 : 0;
    const daysTracked = new Set([...wellnessWater.map((l) => l.date), ...wellnessFruit.map((l) => l.date)]).size;

    const totalDogWalks = dogWalkStats.reduce((s, d) => s + d.walkCount, 0);
    const totalDogSeconds = dogWalkStats.reduce((s, d) => s + d.totalSeconds, 0);

    return {
      period: { from: fromStr, to: toStr },
      focus: {
        totalSeconds: totalFocusSeconds,
        sessionCount: totalSessions,
        completedCount: totalCompleted,
        dailyStats: timerStats.map((d) => ({ date: d.date, totalSeconds: d.totalSeconds })),
      },
      triage: { byStatus: triageByStatus, totalTriaged: triageCount },
      wellness: { waterAvg, fruitAvg, daysTracked },
      email: { received: emailStats.total, unread: emailStats.unread, dailyStats: emailStats.dailyStats },
      events: { total: eventStats.total, dailyStats: eventStats.dailyStats },
      dogWalk: { totalWalks: totalDogWalks, totalSeconds: totalDogSeconds, dailyStats: dogWalkStats.map((d) => ({ date: d.date, walkCount: d.walkCount })) },
    };
  }

  async getStreak(): Promise<StreakData> {
    // Get daily stats for last 90 days
    const from = new Date();
    from.setDate(from.getDate() - 90);
    const stats = await this.timerRepo.getDailyStats(from, new Date());

    // Build a Set of dates that have focus time
    const activeDays = new Set(stats.filter((s) => s.totalSeconds > 0).map((s) => s.date));

    // Calculate current streak (consecutive days ending today or yesterday)
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i <= 90; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      if (activeDays.has(dateStr)) {
        currentStreak++;
      } else if (i === 0) {
        // Today has no activity yet, that's ok, continue checking from yesterday
        continue;
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    const sortedDates = [...activeDays].sort();
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        tempStreak = diffDays === 1 ? tempStreak + 1 : 1;
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    // Last 30 days data for contribution graph
    const last30: { date: string; totalSeconds: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const dayStat = stats.find((s) => s.date === dateStr);
      last30.push({ date: dateStr, totalSeconds: dayStat?.totalSeconds ?? 0 });
    }

    return { currentStreak, longestStreak, last30Days: last30 };
  }

  async getWeeklyReview(weekIso: string): Promise<WeeklyReview> {
    // Parse "2026-W12" format
    const match = weekIso.match(/^(\d{4})-W(\d{1,2})$/);
    if (!match) throw new Error("Invalid week format. Use YYYY-WNN (e.g., 2026-W12)");

    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    const currentFrom = getWeekStart(year, week);
    const currentTo = new Date(currentFrom);
    currentTo.setDate(currentTo.getDate() + 6);
    currentTo.setHours(23, 59, 59, 999);

    const previousFrom = new Date(currentFrom);
    previousFrom.setDate(previousFrom.getDate() - 7);
    const previousTo = new Date(currentFrom);
    previousTo.setMilliseconds(-1);

    const [current, previous] = await Promise.all([
      this.getOverview(currentFrom, currentTo),
      this.getOverview(previousFrom, previousTo),
    ]);

    return {
      week: weekIso,
      current,
      previous,
      deltas: {
        focusSeconds: pctDelta(current.focus.totalSeconds, previous.focus.totalSeconds),
        sessionCount: pctDelta(current.focus.sessionCount, previous.focus.sessionCount),
        totalTriaged: pctDelta(current.triage.totalTriaged, previous.triage.totalTriaged),
        emailReceived: pctDelta(current.email.received, previous.email.received),
        eventsTotal: pctDelta(current.events.total, previous.events.total),
        dogWalks: pctDelta(current.dogWalk.totalWalks, previous.dogWalk.totalWalks),
      },
    };
  }

  async getProductivityPatterns(from: Date, to: Date): Promise<ProductivityPatterns> {
    const sessions = await this.timerRepo.findAll(from, to);

    // Aggregate by hour of day
    const hourlyMap = new Map<number, number[]>();
    const weekdayMap = new Map<number, number[]>();

    for (const s of sessions) {
      const startHour = new Date(s.startedAt).getHours();
      const weekday = new Date(s.startedAt).getDay();

      if (!hourlyMap.has(startHour)) hourlyMap.set(startHour, []);
      hourlyMap.get(startHour)!.push(s.actualSeconds);

      if (!weekdayMap.has(weekday)) weekdayMap.set(weekday, []);
      weekdayMap.get(weekday)!.push(s.actualSeconds);
    }

    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

    const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      avgMinutes: Math.round(
        (hourlyMap.get(h)?.reduce((a, b) => a + b, 0) ?? 0) /
        Math.max(1, new Set(sessions.filter(s => new Date(s.startedAt).getHours() === h).map(s => new Date(s.startedAt).toISOString().split("T")[0])).size) /
        60
      ),
    }));

    const weekdayDistribution = Array.from({ length: 7 }, (_, d) => ({
      day: d,
      dayName: dayNames[d],
      avgMinutes: Math.round(
        (weekdayMap.get(d)?.reduce((a, b) => a + b, 0) ?? 0) /
        Math.max(1, new Set(sessions.filter(s => new Date(s.startedAt).getDay() === d).map(s => new Date(s.startedAt).toISOString().split("T")[0])).size) /
        60
      ),
    }));

    // Best hours (top 3 with most avg minutes)
    const bestHours = [...hourlyDistribution]
      .sort((a, b) => b.avgMinutes - a.avgMinutes)
      .filter(h => h.avgMinutes > 0)
      .slice(0, 3)
      .map(h => h.hour);

    // Best days (top 2)
    const bestDays = [...weekdayDistribution]
      .sort((a, b) => b.avgMinutes - a.avgMinutes)
      .filter(d => d.avgMinutes > 0)
      .slice(0, 2)
      .map(d => d.dayName);

    // Weekly trend: compare this period total vs same-length previous period
    const periodMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodMs);
    const prevSessions = await this.timerRepo.findAll(prevFrom, from);
    const currentTotal = sessions.reduce((a, s) => a + s.actualSeconds, 0);
    const prevTotal = prevSessions.reduce((a, s) => a + s.actualSeconds, 0);
    const weeklyTrend = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : null;

    return { hourlyDistribution, weekdayDistribution, bestHours, bestDays, weeklyTrend };
  }

  async getTimesheet(weekStr: string): Promise<TimesheetData> {
    // Parse week string "2026-W12" to get Monday-Sunday range
    const match = weekStr.match(/^(\d{4})-W(\d{1,2})$/);
    if (!match) throw new Error("Invalid week format. Use YYYY-WNN (e.g., 2026-W12)");

    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    const monday = getWeekStart(year, week);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Generate date strings for the 7 days
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      dates.push(formatDate(d));
    }

    // Get all timer sessions in that week
    const sessions = await this.timerRepo.findAll(monday, sunday);

    // Group by taskId + date
    const taskMap = new Map<string | null, { days: Record<string, number>; totalSeconds: number }>();
    for (const s of sessions) {
      const key = s.taskId || null;
      const dateStr = formatDate(new Date(s.startedAt));

      if (!taskMap.has(key)) {
        taskMap.set(key, { days: {}, totalSeconds: 0 });
      }
      const entry = taskMap.get(key)!;
      entry.days[dateStr] = (entry.days[dateStr] || 0) + s.actualSeconds;
      entry.totalSeconds += s.actualSeconds;
    }

    // Build rows with task titles
    const rows: TimesheetRow[] = [];
    for (const [taskId, data] of taskMap) {
      let taskTitle: string | null = null;
      if (taskId) {
        try {
          const task = await this.taskRepo.findById(taskId);
          taskTitle = task?.title ?? null;
        } catch {
          // Skip if task lookup fails
        }
      }
      rows.push({ taskId, taskTitle, days: data.days, totalSeconds: data.totalSeconds });
    }

    // Sort by totalSeconds descending
    rows.sort((a, b) => b.totalSeconds - a.totalSeconds);

    // Compute daily totals
    const dailyTotals: Record<string, number> = {};
    for (const date of dates) {
      dailyTotals[date] = rows.reduce((sum, row) => sum + (row.days[date] || 0), 0);
    }

    const grandTotal = rows.reduce((sum, row) => sum + row.totalSeconds, 0);

    return {
      weekStart: formatDate(monday),
      weekEnd: formatDate(sunday),
      dates,
      rows,
      dailyTotals,
      grandTotal,
    };
  }

  async getTimeByTask(from: Date, to: Date): Promise<TaskTimeEntry[]> {
    const sessions = await this.timerRepo.findAll(from, to);

    // Group by taskId
    const map = new Map<string | null, { totalSeconds: number; sessionCount: number }>();
    for (const s of sessions) {
      const key = s.taskId || null;
      const entry = map.get(key) || { totalSeconds: 0, sessionCount: 0 };
      entry.totalSeconds += s.actualSeconds;
      entry.sessionCount++;
      map.set(key, entry);
    }

    // Fetch task titles for non-null taskIds
    const result: TaskTimeEntry[] = [];
    for (const [taskId, data] of map) {
      let taskTitle: string | null = null;
      if (taskId) {
        try {
          const task = await this.taskRepo.findById(taskId);
          taskTitle = task?.title ?? null;
        } catch {
          // Skip if task lookup fails
        }
      }
      result.push({ taskId, taskTitle, ...data });
    }

    // Sort by totalSeconds descending
    result.sort((a, b) => b.totalSeconds - a.totalSeconds);
    return result;
  }

  async getTimeByProject(from: Date, to: Date): Promise<ProjectTimeEntry[]> {
    const sessions = await this.timerRepo.findAll(from, to);

    // Group by projectId
    const map = new Map<string | null, { totalSeconds: number; sessionCount: number }>();
    for (const s of sessions) {
      const key = s.projectId || null;
      const entry = map.get(key) || { totalSeconds: 0, sessionCount: 0 };
      entry.totalSeconds += s.actualSeconds;
      entry.sessionCount++;
      map.set(key, entry);
    }

    // Fetch project names
    const result: ProjectTimeEntry[] = [];
    for (const [projectId, data] of map) {
      let projectName: string | null = null;
      let color: string | null = null;
      if (projectId && this.projectRepo) {
        try {
          const project = await this.projectRepo.findById(projectId);
          projectName = project?.name ?? null;
          color = project?.color ?? null;
        } catch {
          // Skip if project lookup fails
        }
      }
      result.push({ projectId, projectName, color, ...data });
    }

    result.sort((a, b) => b.totalSeconds - a.totalSeconds);
    return result;
  }
}

function getWeekStart(year: number, week: number): Date {
  // ISO 8601: Week 1 contains January 4
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Mon=1..Sun=7
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);

  const result = new Date(mondayOfWeek1);
  result.setDate(result.getDate() + (week - 1) * 7);
  result.setHours(0, 0, 0, 0);
  return result;
}
