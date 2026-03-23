import { describe, test, expect, beforeEach, mock } from "bun:test";
import { SmartReminderService } from "../../application/smart-reminder/smart-reminder.service";
import type { FluxRepository } from "../../domain/flux/flux.repository";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { EmailRepository } from "../../domain/email/email.repository";
import type { FluxItem } from "../../domain/flux/flux.entity";

function makeFluxItem(overrides: Partial<FluxItem> = {}): FluxItem {
  return {
    id: "triage-1",
    entityType: "task",
    entityId: "task-1",
    fluxStatus: "priority",
    decidedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
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

describe("SmartReminderService", () => {
  let service: SmartReminderService;
  let fluxRepo: ReturnType<typeof createMockFluxRepo>;
  let taskRepo: ReturnType<typeof createMockTaskRepo>;
  let emailRepo: ReturnType<typeof createMockEmailRepo>;

  beforeEach(() => {
    fluxRepo = createMockFluxRepo();
    taskRepo = createMockTaskRepo();
    emailRepo = createMockEmailRepo();
    service = new SmartReminderService(
      fluxRepo as unknown as FluxRepository,
      taskRepo as unknown as TaskRepository,
      emailRepo as unknown as EmailRepository,
    );
  });

  describe("getAlerts", () => {
    test("returns empty array when no alerts", async () => {
      const result = await service.getAlerts();
      expect(result).toEqual([]);
    });

    test("returns stale_priority alert when priority items are old", async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      fluxRepo.findByStatus.mockReturnValue(
        Promise.resolve([makeFluxItem({ decidedAt: fiveDaysAgo })]),
      );

      const result = await service.getAlerts();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("stale_priority");
      expect(result[0].count).toBe(1);
      expect(result[0].message).toContain("1 tache prioritaire en attente");
    });

    test("returns stale_priority alert with plural when multiple items", async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      fluxRepo.findByStatus.mockReturnValue(
        Promise.resolve([
          makeFluxItem({ id: "t-1", decidedAt: fiveDaysAgo }),
          makeFluxItem({ id: "t-2", entityId: "task-2", decidedAt: fiveDaysAgo }),
        ]),
      );

      const result = await service.getAlerts();
      const staleAlert = result.find((a) => a.type === "stale_priority");

      expect(staleAlert).toBeDefined();
      expect(staleAlert!.count).toBe(2);
      expect(staleAlert!.message).toContain("2 taches prioritaires en attente");
    });

    test("does not return stale_priority when items are recent", async () => {
      fluxRepo.findByStatus.mockReturnValue(
        Promise.resolve([makeFluxItem({ decidedAt: new Date() })]),
      );

      const result = await service.getAlerts();
      expect(result.find((a) => a.type === "stale_priority")).toBeUndefined();
    });

    test("returns untriaged alert when tasks exist without triage", async () => {
      taskRepo.findAll.mockReturnValue(
        Promise.resolve([
          { id: "task-1", title: "Task 1", source: "manual" },
          { id: "task-2", title: "Task 2", source: "manual" },
        ] as any),
      );
      fluxRepo.findAll.mockReturnValue(
        Promise.resolve([makeFluxItem({ entityId: "task-1" })]),
      );

      const result = await service.getAlerts();
      const untriagedAlert = result.find((a) => a.type === "untriaged");

      expect(untriagedAlert).toBeDefined();
      expect(untriagedAlert!.count).toBe(1);
      expect(untriagedAlert!.message).toContain("1 tache non triee");
    });

    test("returns untriaged alert with plural for multiple tasks", async () => {
      taskRepo.findAll.mockReturnValue(
        Promise.resolve([
          { id: "task-1", title: "Task 1", source: "manual" },
          { id: "task-2", title: "Task 2", source: "manual" },
          { id: "task-3", title: "Task 3", source: "manual" },
        ] as any),
      );
      fluxRepo.findAll.mockReturnValue(Promise.resolve([]));

      const result = await service.getAlerts();
      const untriagedAlert = result.find((a) => a.type === "untriaged");

      expect(untriagedAlert).toBeDefined();
      expect(untriagedAlert!.count).toBe(3);
      expect(untriagedAlert!.message).toContain("3 taches non triees");
    });

    test("does not return untriaged alert when all tasks are triaged", async () => {
      taskRepo.findAll.mockReturnValue(
        Promise.resolve([{ id: "task-1", title: "T1", source: "manual" }] as any),
      );
      fluxRepo.findAll.mockReturnValue(
        Promise.resolve([makeFluxItem({ entityId: "task-1" })]),
      );

      const result = await service.getAlerts();
      expect(result.find((a) => a.type === "untriaged")).toBeUndefined();
    });

    test("returns unread_emails alert when count > 10", async () => {
      emailRepo.countUnread.mockReturnValue(Promise.resolve(25));

      const result = await service.getAlerts();
      const emailAlert = result.find((a) => a.type === "unread_emails");

      expect(emailAlert).toBeDefined();
      expect(emailAlert!.count).toBe(25);
      expect(emailAlert!.message).toBe("25 emails non lus");
    });

    test("does not return unread_emails alert when count <= 10", async () => {
      emailRepo.countUnread.mockReturnValue(Promise.resolve(10));

      const result = await service.getAlerts();
      expect(result.find((a) => a.type === "unread_emails")).toBeUndefined();
    });

    test("does not return unread_emails alert when count is 0", async () => {
      emailRepo.countUnread.mockReturnValue(Promise.resolve(0));

      const result = await service.getAlerts();
      expect(result.find((a) => a.type === "unread_emails")).toBeUndefined();
    });

    test("returns all three alerts when all conditions met", async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      fluxRepo.findByStatus.mockReturnValue(
        Promise.resolve([makeFluxItem({ decidedAt: fiveDaysAgo })]),
      );
      taskRepo.findAll.mockReturnValue(
        Promise.resolve([{ id: "task-99", title: "X", source: "manual" }] as any),
      );
      fluxRepo.findAll.mockReturnValue(Promise.resolve([]));
      emailRepo.countUnread.mockReturnValue(Promise.resolve(50));

      const result = await service.getAlerts();

      expect(result).toHaveLength(3);
      expect(result.map((a) => a.type).sort()).toEqual(["stale_priority", "unread_emails", "untriaged"]);
    });
  });
});
