import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AnalyticsService } from "../../application/analytics/analytics.service";
import type { TimerSessionRepository, DailyTimerStats } from "../../domain/timer-session/timer-session.repository";
import type { DogWalkRepository } from "../../domain/dog-walk/dog-walk.repository";
import type { WellnessLogRepository } from "../../domain/wellness-log/wellness-log.repository";
import type { FluxRepository } from "../../domain/flux/flux.repository";
import type { EmailRepository } from "../../domain/email/email.repository";
import type { EventRepository } from "../../domain/event/event.repository";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { ProjectRepository } from "../../domain/project/project.repository";

function makeMockRepos() {
  return {
    timerRepo: { findAll: mock(() => Promise.resolve([])), findById: mock(() => Promise.resolve(null)), create: mock(() => Promise.resolve({} as any)), getTodayStats: mock(() => Promise.resolve({ totalSeconds: 0, sessionCount: 0 })), getDailyStats: mock(() => Promise.resolve([] as DailyTimerStats[])) } as unknown as TimerSessionRepository,
    dogWalkRepo: { findActive: mock(() => Promise.resolve(null)), findAll: mock(() => Promise.resolve([])), create: mock(() => Promise.resolve({} as any)), stop: mock(() => Promise.resolve({} as any)), getTodayStats: mock(() => Promise.resolve({ totalSeconds: 0, walkCount: 0 })), getDailyStats: mock(() => Promise.resolve([])) } as unknown as DogWalkRepository,
    wellnessLogRepo: { findByDateAndType: mock(() => Promise.resolve(null)), findByDate: mock(() => Promise.resolve([])), findByRange: mock(() => Promise.resolve([])), upsert: mock(() => Promise.resolve({} as any)), increment: mock(() => Promise.resolve(null)) } as unknown as WellnessLogRepository,
    fluxRepo: { findAll: mock(() => Promise.resolve([])), findByStatus: mock(() => Promise.resolve([])), findByEntity: mock(() => Promise.resolve(null)), upsert: mock(() => Promise.resolve({} as any)), bulkUpsert: mock(() => Promise.resolve()), deleteByEntity: mock(() => Promise.resolve()), deleteAll: mock(() => Promise.resolve()), countByStatus: mock(() => Promise.resolve({})), countByDateRange: mock(() => Promise.resolve(0)) } as unknown as FluxRepository,
    emailRepo: { findByAccount: mock(() => Promise.resolve([])), findAll: mock(() => Promise.resolve([])), findById: mock(() => Promise.resolve(null)), findMaxUid: mock(() => Promise.resolve(null)), create: mock(() => Promise.resolve(null)), bulkCreate: mock(() => Promise.resolve(0)), updateFlags: mock(() => Promise.resolve(null)), delete: mock(() => Promise.resolve(false)), countUnread: mock(() => Promise.resolve(0)), countByDateRange: mock(() => Promise.resolve({ total: 0, unread: 0, dailyStats: [] })) } as unknown as EmailRepository,
    eventRepo: { findAll: mock(() => Promise.resolve([])), findByCalendarId: mock(() => Promise.resolve([])), findById: mock(() => Promise.resolve(null)), findByTaskId: mock(() => Promise.resolve(null)), create: mock(() => Promise.resolve({} as any)), update: mock(() => Promise.resolve(null)), delete: mock(() => Promise.resolve(false)), countByDateRange: mock(() => Promise.resolve({ total: 0, dailyStats: [] })) } as unknown as EventRepository,
    taskRepo: { findAll: mock(() => Promise.resolve([])), findById: mock(() => Promise.resolve(null)), findByExternalId: mock(() => Promise.resolve(null)), findBySource: mock(() => Promise.resolve([])), findUnscheduled: mock(() => Promise.resolve([])), upsertByExternalId: mock(() => Promise.resolve({} as any)), create: mock(() => Promise.resolve({} as any)), deleteBySource: mock(() => Promise.resolve()), deleteNotInExternalIds: mock(() => Promise.resolve()), delete: mock(() => Promise.resolve(false)) } as unknown as TaskRepository,
  };
}

const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("AnalyticsService — Extended", () => {
  let service: AnalyticsService;
  let repos: ReturnType<typeof makeMockRepos>;

  beforeEach(() => {
    repos = makeMockRepos();
    service = new AnalyticsService(repos.timerRepo, repos.dogWalkRepo, repos.wellnessLogRepo, repos.fluxRepo, repos.emailRepo, repos.eventRepo, repos.taskRepo);
  });

  describe("getStreak", () => {
    it("should compute current streak from consecutive days", async () => {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const y2 = new Date(); y2.setDate(y2.getDate() - 2);
      (repos.timerRepo.getDailyStats as any).mockReturnValue(Promise.resolve([
        { date: fmtDate(y), totalSeconds: 3600, sessionCount: 1, completedCount: 1, cancelledCount: 0 },
        { date: fmtDate(y2), totalSeconds: 1800, sessionCount: 1, completedCount: 1, cancelledCount: 0 },
      ]));
      const result = await service.getStreak();
      expect(result.currentStreak).toBe(2);
      expect(result.last30Days).toHaveLength(30);
    });

    it("should return 0 when no active days", async () => {
      const result = await service.getStreak();
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
    });
  });

  describe("getProductivityPatterns", () => {
    it("should return hourly/weekday distribution", async () => {
      (repos.timerRepo.findAll as any)
        .mockReturnValueOnce(Promise.resolve([
          { id: "1", startedAt: new Date("2026-03-10T09:00:00"), actualSeconds: 1800 },
          { id: "2", startedAt: new Date("2026-03-10T14:00:00"), actualSeconds: 3600 },
        ]))
        .mockReturnValueOnce(Promise.resolve([]));
      const result = await service.getProductivityPatterns(new Date("2026-03-10"), new Date("2026-03-16"));
      expect(result.hourlyDistribution).toHaveLength(24);
      expect(result.weekdayDistribution).toHaveLength(7);
    });

    it("should return null weeklyTrend when no previous data", async () => {
      (repos.timerRepo.findAll as any)
        .mockReturnValueOnce(Promise.resolve([{ id: "1", startedAt: new Date("2026-03-10T09:00:00"), actualSeconds: 1800 }]))
        .mockReturnValueOnce(Promise.resolve([]));
      const result = await service.getProductivityPatterns(new Date("2026-03-10"), new Date("2026-03-16"));
      expect(result.weeklyTrend).toBeNull();
    });

    it("should compute weeklyTrend", async () => {
      (repos.timerRepo.findAll as any)
        .mockReturnValueOnce(Promise.resolve([{ id: "1", startedAt: new Date("2026-03-10T09:00:00"), actualSeconds: 2000 }]))
        .mockReturnValueOnce(Promise.resolve([{ id: "2", startedAt: new Date("2026-03-04T09:00:00"), actualSeconds: 1000 }]));
      const result = await service.getProductivityPatterns(new Date("2026-03-10"), new Date("2026-03-16"));
      expect(result.weeklyTrend).toBe(100);
    });
  });

  describe("getTimesheet", () => {
    it("should return valid timesheet", async () => {
      (repos.timerRepo.findAll as any).mockReturnValue(Promise.resolve([
        { id: "1", startedAt: new Date("2026-03-16T09:00:00"), actualSeconds: 3600, taskId: null },
      ]));
      const result = await service.getTimesheet("2026-W12");
      expect(result.dates).toHaveLength(7);
      expect(result.grandTotal).toBe(3600);
    });

    it("should throw for invalid format", async () => {
      await expect(service.getTimesheet("bad")).rejects.toThrow("Invalid week format");
    });
  });

  describe("getTimeByTask", () => {
    it("should group by taskId", async () => {
      (repos.timerRepo.findAll as any).mockReturnValue(Promise.resolve([
        { id: "1", startedAt: new Date("2026-03-10T09:00:00"), actualSeconds: 3600, taskId: "t1" },
        { id: "2", startedAt: new Date("2026-03-11T09:00:00"), actualSeconds: 1800, taskId: "t1" },
        { id: "3", startedAt: new Date("2026-03-10T14:00:00"), actualSeconds: 900, taskId: null },
      ]));
      (repos.taskRepo.findById as any).mockReturnValue(Promise.resolve({ id: "t1", title: "Task" }));
      const result = await service.getTimeByTask(new Date("2026-03-10"), new Date("2026-03-16"));
      expect(result).toHaveLength(2);
      expect(result[0].totalSeconds).toBe(5400);
    });
  });

  describe("getTimeByProject", () => {
    it("should group by projectId with project details", async () => {
      const projectRepo = { findAll: mock(() => Promise.resolve([])), findById: mock((id: string) => id === "p1" ? Promise.resolve({ id: "p1", name: "Web", color: "#f00" }) : Promise.resolve(null)), create: mock(() => Promise.resolve({} as any)), update: mock(() => Promise.resolve(null)), delete: mock(() => Promise.resolve(false)) } as unknown as ProjectRepository;
      const svc = new AnalyticsService(repos.timerRepo, repos.dogWalkRepo, repos.wellnessLogRepo, repos.fluxRepo, repos.emailRepo, repos.eventRepo, repos.taskRepo, projectRepo);
      (repos.timerRepo.findAll as any).mockReturnValue(Promise.resolve([
        { id: "1", startedAt: new Date("2026-03-10T09:00:00"), actualSeconds: 3600, taskId: null, projectId: "p1" },
        { id: "2", startedAt: new Date("2026-03-10T14:00:00"), actualSeconds: 900, taskId: null, projectId: null },
      ]));
      const result = await svc.getTimeByProject(new Date("2026-03-10"), new Date("2026-03-16"));
      expect(result).toHaveLength(2);
      expect(result[0].projectName).toBe("Web");
    });
  });
});
