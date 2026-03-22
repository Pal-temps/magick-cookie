import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AnalyticsService } from "../../application/analytics/analytics.service";
import type { TimerSessionRepository, DailyTimerStats } from "../../domain/timer-session/timer-session.repository";
import type { DogWalkRepository } from "../../domain/dog-walk/dog-walk.repository";
import type { WellnessLogRepository } from "../../domain/wellness-log/wellness-log.repository";
import type { TriageRepository } from "../../domain/triage/triage.repository";
import type { EmailRepository } from "../../domain/email/email.repository";
import type { EventRepository } from "../../domain/event/event.repository";
import type { TaskRepository } from "../../domain/task/task.repository";

function makeMockRepos() {
  return {
    timerRepo: {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({} as any)),
      getTodayStats: mock(() => Promise.resolve({ totalSeconds: 0, sessionCount: 0 })),
      getDailyStats: mock(() => Promise.resolve([
        { date: "2026-03-10", totalSeconds: 3600, focusSeconds: 3000, sessionCount: 4, completedCount: 3, cancelledCount: 1 },
        { date: "2026-03-11", totalSeconds: 1800, focusSeconds: 1500, sessionCount: 2, completedCount: 2, cancelledCount: 0 },
      ] as DailyTimerStats[])),
    } as unknown as TimerSessionRepository,
    dogWalkRepo: {
      findActive: mock(() => Promise.resolve(null)),
      findAll: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve({} as any)),
      stop: mock(() => Promise.resolve({} as any)),
      getTodayStats: mock(() => Promise.resolve({ totalSeconds: 0, walkCount: 0 })),
      getDailyStats: mock(() => Promise.resolve([{ date: "2026-03-10", totalSeconds: 1200, walkCount: 2 }])),
    } as unknown as DogWalkRepository,
    wellnessLogRepo: {
      findByDateAndType: mock(() => Promise.resolve(null)),
      findByDate: mock(() => Promise.resolve([])),
      findByRange: mock((_f: string, _t: string, type?: string) => {
        if (type === "water") return Promise.resolve([
          { id: "1", type: "water", date: "2026-03-10", value: 2000, goal: 2000, createdAt: new Date(), updatedAt: new Date() },
          { id: "2", type: "water", date: "2026-03-11", value: 1500, goal: 2000, createdAt: new Date(), updatedAt: new Date() },
        ]);
        return Promise.resolve([
          { id: "3", type: "fruits_veggies", date: "2026-03-10", value: 5, goal: 5, createdAt: new Date(), updatedAt: new Date() },
        ]);
      }),
      upsert: mock(() => Promise.resolve({} as any)),
      increment: mock(() => Promise.resolve(null)),
    } as unknown as WellnessLogRepository,
    triageRepo: {
      findAll: mock(() => Promise.resolve([])),
      findByStatus: mock(() => Promise.resolve([])),
      findByTaskId: mock(() => Promise.resolve(null)),
      upsert: mock(() => Promise.resolve({} as any)),
      bulkUpsert: mock(() => Promise.resolve()),
      deleteByTaskId: mock(() => Promise.resolve()),
      deleteAll: mock(() => Promise.resolve()),
      countByStatus: mock(() => Promise.resolve({ priority: 5, later: 3, archived: 2 })),
      countByDateRange: mock(() => Promise.resolve(10)),
    } as unknown as TriageRepository,
    emailRepo: {
      findByAccount: mock(() => Promise.resolve([])),
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findMaxUid: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(null)),
      bulkCreate: mock(() => Promise.resolve(0)),
      updateFlags: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
      countUnread: mock(() => Promise.resolve(0)),
      countByDateRange: mock(() => Promise.resolve({ total: 25, unread: 8, dailyStats: [{ date: "2026-03-10", count: 15 }, { date: "2026-03-11", count: 10 }] })),
    } as unknown as EmailRepository,
    eventRepo: {
      findAll: mock(() => Promise.resolve([])),
      findByCalendarId: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findByTaskId: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({} as any)),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
      countByDateRange: mock(() => Promise.resolve({ total: 12, dailyStats: [{ date: "2026-03-10", count: 7 }, { date: "2026-03-11", count: 5 }] })),
    } as unknown as EventRepository,
    taskRepo: {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findByExternalId: mock(() => Promise.resolve(null)),
      findBySource: mock(() => Promise.resolve([])),
      findUnscheduled: mock(() => Promise.resolve([])),
      upsertByExternalId: mock(() => Promise.resolve({} as any)),
      create: mock(() => Promise.resolve({} as any)),
      deleteBySource: mock(() => Promise.resolve()),
      deleteNotInExternalIds: mock(() => Promise.resolve()),
      delete: mock(() => Promise.resolve(false)),
    } as unknown as TaskRepository,
  };
}

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let repos: ReturnType<typeof makeMockRepos>;

  beforeEach(() => {
    repos = makeMockRepos();
    service = new AnalyticsService(repos.timerRepo, repos.dogWalkRepo, repos.wellnessLogRepo, repos.triageRepo, repos.emailRepo, repos.eventRepo, repos.taskRepo);
  });

  describe("getOverview", () => {
    it("should aggregate data from all repos", async () => {
      const result = await service.getOverview(new Date("2026-03-10"), new Date("2026-03-16"));
      expect(result.period.from).toBe("2026-03-10");
      expect(result.focus.totalSeconds).toBe(5400);
      expect(result.focus.sessionCount).toBe(6);
      expect(result.triage.totalTriaged).toBe(10);
      expect(result.email.received).toBe(25);
      expect(result.events.total).toBe(12);
      expect(result.dogWalk.totalWalks).toBe(2);
      expect(result.wellness.daysTracked).toBe(2);
    });
  });

  describe("getWeeklyReview", () => {
    it("should return current and previous week data with deltas", async () => {
      const result = await service.getWeeklyReview("2026-W12");
      expect(result.week).toBe("2026-W12");
      expect(result.current).toBeDefined();
      expect(result.previous).toBeDefined();
      expect(result.deltas.focusSeconds).toBe(0);
    });

    it("should throw for invalid week format", async () => {
      await expect(service.getWeeklyReview("invalid")).rejects.toThrow("Invalid week format");
    });
  });

  describe("buildNarrativeData", () => {
    function makeReview() {
      const overview = {
        period: { from: "2026-03-10", to: "2026-03-16" },
        focus: { totalSeconds: 5400, sessionCount: 6, completedCount: 5, dailyStats: [] },
        triage: { byStatus: { priority: 5 }, totalTriaged: 10 },
        wellness: { waterAvg: 1750, fruitAvg: 5, daysTracked: 5 },
        email: { received: 25, unread: 8, dailyStats: [] },
        events: { total: 12, dailyStats: [] },
        dogWalk: { totalWalks: 2, totalSeconds: 1200, dailyStats: [] },
      };
      return {
        week: "2026-W12",
        current: overview,
        previous: overview,
        deltas: { focusSeconds: 10, sessionCount: null, totalTriaged: -5, emailReceived: 20, eventsTotal: null, dogWalks: 0 },
      };
    }

    it("should return valid JSON with all fields", () => {
      const parsed = JSON.parse(service.buildNarrativeData(makeReview()));
      expect(parsed.semaine).toBe("2026-W12");
      expect(parsed.focus.heures).toBe(1);
      expect(parsed.focus.minutes).toBe(30);
      expect(parsed.triage.total).toBe(10);
      expect(parsed.emails.recus).toBe(25);
      expect(parsed.balades.minutes).toBe(20);
      expect(parsed.wellness.eauMoyenne).toBe(1750);
    });
  });
});
