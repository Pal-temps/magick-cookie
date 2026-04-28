import { describe, test, expect, beforeEach, mock } from "bun:test";
import { BriefService } from "../../application/brief/brief.service";
import type { TimerSessionRepository } from "../../domain/timer-session/timer-session.repository";
import type { EventRepository } from "../../domain/event/event.repository";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { FluxRepository } from "../../domain/flux/flux.repository";
import type { EmailRepository } from "../../domain/email/email.repository";
import type { LlmService } from "../../application/llm/llm.service";
import type { GitScanService } from "../../application/git/git-scan.service";

function createMockTimerRepo() {
  return {
    findAll: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    findByTaskId: mock(() => Promise.resolve([])),
    create: mock(() => Promise.resolve({} as any)),
    getTodayStats: mock(() => Promise.resolve({ totalSeconds: 0, sessionCount: 0 })),
    getDailyStats: mock(() => Promise.resolve([])),
  };
}

function createMockEventRepo() {
  return {
    findAll: mock(() => Promise.resolve([])),
    findByCalendarId: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    findByTaskId: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve({} as any)),
    update: mock(() => Promise.resolve(null)),
    delete: mock(() => Promise.resolve(false)),
    countByDateRange: mock(() => Promise.resolve({ total: 0, dailyStats: [] })),
  };
}

function createMockTaskRepo() {
  return {
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
  };
}

function createMockFluxRepo() {
  return {
    findAll: mock(() => Promise.resolve([])),
    findByStatus: mock(() => Promise.resolve([])),
    findByEntity: mock(() => Promise.resolve(null)),
    upsert: mock(() => Promise.resolve({} as any)),
    bulkUpsert: mock(() => Promise.resolve()),
    deleteByEntity: mock(() => Promise.resolve()),
    deleteAll: mock(() => Promise.resolve()),
    countByStatus: mock(() => Promise.resolve({})),
    countByDateRange: mock(() => Promise.resolve(0)),
  };
}

function createMockEmailRepo() {
  return {
    findByAccount: mock(() => Promise.resolve([])),
    findAll: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    findMaxUid: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve(null)),
    bulkCreate: mock(() => Promise.resolve(0)),
    updateFlags: mock(() => Promise.resolve(null)),
    delete: mock(() => Promise.resolve(false)),
    countUnread: mock(() => Promise.resolve(0)),
    countByDateRange: mock(() => Promise.resolve({ total: 0, unread: 0, dailyStats: [] })),
    updateSummary: mock(() => Promise.resolve(null)),
  };
}

function createMockLlmService() {
  return {
    chat: mock(() => Promise.resolve("## Hier\n- RAS\n## Aujourd'hui\n- RAS")),
  };
}

function createMockGitScanService() {
  return {
    scanSince: mock(() =>
      Promise.resolve({
        commits: [{ hash: "abc123", message: "fix bug", repo: "my-repo" }],
        repoCount: 1,
        totalCommits: 1,
      }),
    ),
  };
}

describe("BriefService", () => {
  let timerRepo: ReturnType<typeof createMockTimerRepo>;
  let eventRepo: ReturnType<typeof createMockEventRepo>;
  let taskRepo: ReturnType<typeof createMockTaskRepo>;
  let fluxRepo: ReturnType<typeof createMockFluxRepo>;
  let emailRepo: ReturnType<typeof createMockEmailRepo>;
  let llmService: ReturnType<typeof createMockLlmService>;
  let gitScanService: ReturnType<typeof createMockGitScanService>;
  let service: BriefService;

  beforeEach(() => {
    timerRepo = createMockTimerRepo();
    eventRepo = createMockEventRepo();
    taskRepo = createMockTaskRepo();
    fluxRepo = createMockFluxRepo();
    emailRepo = createMockEmailRepo();
    llmService = createMockLlmService();
    gitScanService = createMockGitScanService();
    service = new BriefService(
      timerRepo as unknown as TimerSessionRepository,
      eventRepo as unknown as EventRepository,
      taskRepo as unknown as TaskRepository,
      fluxRepo as unknown as FluxRepository,
      emailRepo as unknown as EmailRepository,
      llmService as unknown as LlmService,
      gitScanService as unknown as GitScanService,
    );
  });

  describe("generate", () => {
    test("returns brief response with date, rawData, and brief text", async () => {
      const date = new Date("2026-03-18");
      const result = await service.generate(date);

      expect(result.date).toBe("2026-03-18");
      expect(result.rawData).toBeDefined();
      expect(result.rawData.yesterday).toBeDefined();
      expect(result.rawData.today).toBeDefined();
      expect(result.rawData.blockers).toBeDefined();
      expect(result.brief).toContain("Hier");
    });

    test("collects yesterday timer sessions", async () => {
      timerRepo.findAll.mockReturnValue(
        Promise.resolve([
          {
            id: "s-1",
            label: "Deep work",
            actualSeconds: 1800,
            completed: true,
            startedAt: new Date("2026-03-17T10:00:00"),
            endedAt: new Date("2026-03-17T10:30:00"),
            mode: "focus",
            durationMinutes: 30,
            taskId: null,
            projectId: null,
            createdAt: new Date(),
          },
        ]),
      );

      const result = await service.generate(new Date("2026-03-18"));

      expect(result.rawData.yesterday.timerSessions).toHaveLength(1);
      expect(result.rawData.yesterday.timerSessions[0].label).toBe("Deep work");
      expect(result.rawData.yesterday.timerSessions[0].actualSeconds).toBe(1800);
      expect(result.rawData.yesterday.totalFocusSeconds).toBe(1800);
    });

    test("collects yesterday events", async () => {
      eventRepo.findAll.mockReturnValueOnce(
        Promise.resolve([
          {
            id: "e-1",
            title: "Standup",
            startAt: new Date("2026-03-17T09:00:00"),
            endAt: new Date("2026-03-17T09:30:00"),
          },
        ] as any),
      );

      const result = await service.generate(new Date("2026-03-18"));

      expect(result.rawData.yesterday.events).toHaveLength(1);
      expect(result.rawData.yesterday.events[0].title).toBe("Standup");
    });

    test("collects today events", async () => {
      eventRepo.findAll
        .mockReturnValueOnce(Promise.resolve([])) // yesterday
        .mockReturnValueOnce(
          Promise.resolve([
            {
              id: "e-2",
              title: "Sprint Review",
              startAt: new Date("2026-03-18T14:00:00"),
              endAt: new Date("2026-03-18T15:00:00"),
            },
          ] as any),
        );

      const result = await service.generate(new Date("2026-03-18"));

      expect(result.rawData.today.events).toHaveLength(1);
      expect(result.rawData.today.events[0].title).toBe("Sprint Review");
    });

    test("collects yesterday triaged tasks", async () => {
      const yesterday = new Date("2026-03-17T12:00:00");
      fluxRepo.findAll.mockReturnValue(
        Promise.resolve([
          {
            id: "tr-1",
            entityType: "task",
            entityId: "task-1",
            fluxStatus: "priority",
            decidedAt: yesterday,
            createdAt: yesterday,
            updatedAt: yesterday,
          },
        ]),
      );
      taskRepo.findById.mockReturnValue(
        Promise.resolve({ id: "task-1", title: "Fix bug", source: "clickup" } as any),
      );

      const result = await service.generate(new Date("2026-03-18"));

      expect(result.rawData.yesterday.fluxedItems).toHaveLength(1);
      expect(result.rawData.yesterday.fluxedItems[0].title).toBe("Fix bug");
    });

    test("skips triaged tasks when task not found", async () => {
      const yesterday = new Date("2026-03-17T12:00:00");
      fluxRepo.findAll.mockReturnValue(
        Promise.resolve([
          {
            id: "tr-1",
            entityType: "task",
            entityId: "task-deleted",
            fluxStatus: "priority",
            decidedAt: yesterday,
            createdAt: yesterday,
            updatedAt: yesterday,
          },
        ]),
      );
      taskRepo.findById.mockReturnValue(Promise.resolve(null));

      const result = await service.generate(new Date("2026-03-18"));

      expect(result.rawData.yesterday.fluxedItems).toHaveLength(0);
    });

    test("collects priority tasks for today", async () => {
      fluxRepo.findByStatus.mockReturnValue(
        Promise.resolve([
          {
            id: "tr-2",
            entityType: "task",
            entityId: "task-2",
            fluxStatus: "priority",
            decidedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      );
      taskRepo.findById.mockReturnValue(
        Promise.resolve({ id: "task-2", title: "Deploy v2", source: "manual" } as any),
      );

      const result = await service.generate(new Date("2026-03-18"));

      expect(result.rawData.today.priorityTasks).toHaveLength(1);
      expect(result.rawData.today.priorityTasks[0].title).toBe("Deploy v2");
    });

    test("collects unread emails count", async () => {
      emailRepo.countUnread.mockReturnValue(Promise.resolve(15));

      const result = await service.generate(new Date("2026-03-18"));

      expect(result.rawData.today.unreadEmails).toBe(15);
    });

    test("collects stale priority tasks as blockers", async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      fluxRepo.findByStatus.mockReturnValue(
        Promise.resolve([
          {
            id: "tr-3",
            entityType: "task",
            entityId: "task-3",
            fluxStatus: "priority",
            decidedAt: fiveDaysAgo,
            createdAt: fiveDaysAgo,
            updatedAt: fiveDaysAgo,
          },
        ]),
      );
      taskRepo.findById.mockReturnValue(
        Promise.resolve({ id: "task-3", title: "Stale task", source: "manual" } as any),
      );

      const result = await service.generate(new Date("2026-03-18"));

      expect(result.rawData.blockers.staleTasks).toHaveLength(1);
      expect(result.rawData.blockers.staleTasks[0].title).toBe("Stale task");
    });

    test("collects overdue events as blockers", async () => {
      // Use a fixed past date (like the other tests) instead of `new Date()`.
      // The service computes `todayStart = startOfDay(date)` from the param and
      // `now = new Date()` from the wall clock. Filter: `endAt < now AND endAt >= todayStart`.
      // With a fixed past date for `date`, both branches are stable regardless of when
      // the suite runs — previously this test flaked when the wall clock was within an
      // hour of local midnight (pastTime = now - 1h would fall into yesterday).
      const date = new Date("2026-03-18T15:00:00");

      eventRepo.findAll
        .mockReturnValueOnce(Promise.resolve([])) // yesterday events
        .mockReturnValueOnce(
          Promise.resolve([
            {
              id: "e-3",
              title: "Overdue meeting",
              startAt: new Date("2026-03-18T13:00:00"),
              endAt: new Date("2026-03-18T14:00:00"),
            },
          ] as any),
        );

      const result = await service.generate(date);

      expect(result.rawData.blockers.overdueEvents).toHaveLength(1);
      expect(result.rawData.blockers.overdueEvents[0].title).toBe("Overdue meeting");
    });

    test("includes git data when gitScanService is available and has commits", async () => {
      const result = await service.generate(new Date("2026-03-18"));

      expect(result.rawData.git).toBeDefined();
      expect(result.rawData.git!.totalCommits).toBe(1);
      expect(result.rawData.git!.repoCount).toBe(1);
    });

    test("excludes git data when totalCommits is 0", async () => {
      gitScanService.scanSince.mockReturnValue(
        Promise.resolve({ commits: [], repoCount: 0, totalCommits: 0 }),
      );

      const result = await service.generate(new Date("2026-03-18"));

      expect(result.rawData.git).toBeUndefined();
    });

    test("excludes git data when gitScanService throws", async () => {
      gitScanService.scanSince.mockReturnValue(Promise.reject(new Error("git error")));

      const result = await service.generate(new Date("2026-03-18"));

      expect(result.rawData.git).toBeUndefined();
    });

    test("excludes git data when gitScanService is not provided", async () => {
      const serviceNoGit = new BriefService(
        timerRepo as unknown as TimerSessionRepository,
        eventRepo as unknown as EventRepository,
        taskRepo as unknown as TaskRepository,
        fluxRepo as unknown as FluxRepository,
        emailRepo as unknown as EmailRepository,
        llmService as unknown as LlmService,
      );

      const result = await serviceNoGit.generate(new Date("2026-03-18"));

      expect(result.rawData.git).toBeUndefined();
    });

    test("uses custom prompt when provided", async () => {
      await service.generate(new Date("2026-03-18"), "Custom system prompt");

      expect(llmService.chat).toHaveBeenCalledTimes(1);
      const callArgs = llmService.chat.mock.calls[0];
      expect(callArgs[0][0].content).toBe("Custom system prompt");
    });

    test("uses default prompt when no custom prompt", async () => {
      await service.generate(new Date("2026-03-18"));

      expect(llmService.chat).toHaveBeenCalledTimes(1);
      const callArgs = llmService.chat.mock.calls[0];
      expect(callArgs[0][0].content).toContain("Tu es un assistant");
    });

    test("returns empty brief when LLM is null", async () => {
      const serviceNoLlm = new BriefService(
        timerRepo as unknown as TimerSessionRepository,
        eventRepo as unknown as EventRepository,
        taskRepo as unknown as TaskRepository,
        fluxRepo as unknown as FluxRepository,
        emailRepo as unknown as EmailRepository,
        null,
      );

      const result = await serviceNoLlm.generate(new Date("2026-03-18"));

      expect(result.brief).toBe("");
    });

    test("returns empty brief when LLM throws", async () => {
      llmService.chat.mockReturnValue(Promise.reject(new Error("LLM error")));

      const result = await service.generate(new Date("2026-03-18"));

      expect(result.brief).toBe("");
    });

    test("formats date correctly in response", async () => {
      const result = await service.generate(new Date("2026-01-05"));
      expect(result.date).toBe("2026-01-05");
    });
  });
});
