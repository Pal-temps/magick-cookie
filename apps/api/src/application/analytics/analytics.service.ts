import type { TimerSessionRepository, DailyTimerStats } from "../../domain/timer-session/timer-session.repository";
import type { DogWalkRepository } from "../../domain/dog-walk/dog-walk.repository";
import type { WellnessLogRepository } from "../../domain/wellness-log/wellness-log.repository";
import type { TriageRepository } from "../../domain/triage/triage.repository";
import type { EmailRepository } from "../../domain/email/email.repository";
import type { EventRepository } from "../../domain/event/event.repository";

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

export class AnalyticsService {
  constructor(
    private timerRepo: TimerSessionRepository,
    private dogWalkRepo: DogWalkRepository,
    private wellnessLogRepo: WellnessLogRepository,
    private triageRepo: TriageRepository,
    private emailRepo: EmailRepository,
    private eventRepo: EventRepository,
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
