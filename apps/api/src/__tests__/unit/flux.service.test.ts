import { describe, it, expect, beforeEach, mock } from "bun:test";
import { FluxService } from "../../application/flux/flux.service";
import type { FluxRepository } from "../../domain/flux/flux.repository";
import type { FluxItem, SetFluxInput } from "../../domain/flux/flux.entity";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { Task } from "../../domain/task/task.entity";

const now = new Date("2026-04-01");

const makeFluxItem = (overrides: Partial<FluxItem> = {}): FluxItem => ({
  id: "f-1",
  entityType: "task",
  entityId: "t-1",
  fluxStatus: "priority",
  decidedAt: now,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "t-1",
  externalId: null,
  source: "manual",
  title: "Fix bug",
  description: null,
  status: "open",
  priority: "high",
  url: null,
  labels: ["bug"],
  assignees: [],
  dueDate: null,
  startDate: null,
  metadata: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe("FluxService", () => {
  let service: FluxService;
  let mockRepo: Record<keyof FluxRepository, ReturnType<typeof mock>>;
  let mockTaskRepo: Record<keyof TaskRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findByStatus: mock(() => Promise.resolve([])),
      findByEntity: mock(() => Promise.resolve(null)),
      upsert: mock(() => Promise.resolve(makeFluxItem())),
      bulkUpsert: mock(() => Promise.resolve()),
      deleteByEntity: mock(() => Promise.resolve()),
      deleteAll: mock(() => Promise.resolve()),
      countByStatus: mock(() => Promise.resolve({})),
      countByDateRange: mock(() => Promise.resolve(0)),
    };
    mockTaskRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findByExternalId: mock(() => Promise.resolve(null)),
      findBySource: mock(() => Promise.resolve([])),
      findUnscheduled: mock(() => Promise.resolve([])),
      upsertByExternalId: mock(() => Promise.resolve(makeTask())),
      create: mock(() => Promise.resolve(makeTask())),
      deleteBySource: mock(() => Promise.resolve()),
      deleteNotInExternalIds: mock(() => Promise.resolve()),
      delete: mock(() => Promise.resolve(true)),
    };
    service = new FluxService(mockRepo as any, mockTaskRepo as any);
  });

  describe("getAll", () => {
    it("returns all items", async () => {
      const items = [makeFluxItem(), makeFluxItem({ id: "f-2", entityId: "t-2" })];
      mockRepo.findAll.mockReturnValue(Promise.resolve(items));

      const result = await service.getAll();
      expect(result).toHaveLength(2);
      expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
    });

    it("passes entityType filter to repo", async () => {
      await service.getAll("email");
      expect(mockRepo.findAll).toHaveBeenCalledWith("email");
    });
  });

  describe("getByStatus", () => {
    it("returns items filtered by status", async () => {
      const items = [makeFluxItem({ fluxStatus: "later" })];
      mockRepo.findByStatus.mockReturnValue(Promise.resolve(items));

      const result = await service.getByStatus("later");
      expect(result).toHaveLength(1);
      expect(result[0].fluxStatus).toBe("later");
    });

    it("passes both status and entityType", async () => {
      await service.getByStatus("archived", "rss_article");
      expect(mockRepo.findByStatus).toHaveBeenCalledWith("archived", "rss_article");
    });
  });

  describe("setFlux", () => {
    it("upserts and returns the item", async () => {
      const input: SetFluxInput = { entityType: "task", entityId: "t-1", fluxStatus: "priority" };
      const result = await service.setFlux(input);

      expect(mockRepo.upsert).toHaveBeenCalledWith(input);
      expect(result.id).toBe("f-1");
    });
  });

  describe("bulkSetFlux", () => {
    it("calls bulkUpsert on the repo", async () => {
      const inputs: SetFluxInput[] = [
        { entityType: "task", entityId: "t-1", fluxStatus: "priority" },
        { entityType: "email", entityId: "e-1", fluxStatus: "later" },
      ];

      await service.bulkSetFlux(inputs);
      expect(mockRepo.bulkUpsert).toHaveBeenCalledWith(inputs);
    });
  });

  describe("resetFlux", () => {
    it("deletes flux for a specific entity", async () => {
      await service.resetFlux("task", "t-1");
      expect(mockRepo.deleteByEntity).toHaveBeenCalledWith("task", "t-1");
    });
  });

  describe("resetAll", () => {
    it("deletes all flux entries", async () => {
      await service.resetAll();
      expect(mockRepo.deleteAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("suggestFlux", () => {
    it("returns empty when no llmService", async () => {
      const serviceNoLlm = new FluxService(mockRepo as any, mockTaskRepo as any);
      const result = await serviceNoLlm.suggestFlux();
      expect(result).toEqual([]);
    });

    it("returns empty when no untriaged items", async () => {
      const mockLlm = { chat: mock(() => Promise.resolve("[]")) };
      const svc = new FluxService(mockRepo as any, mockTaskRepo as any, mockLlm as any);
      mockRepo.findAll.mockReturnValue(Promise.resolve([]));
      mockTaskRepo.findAll.mockReturnValue(Promise.resolve([]));

      const result = await svc.suggestFlux();
      expect(result).toEqual([]);
    });

    it("skips already triaged tasks", async () => {
      const mockLlm = { chat: mock(() => Promise.resolve("[]")) };
      const svc = new FluxService(mockRepo as any, mockTaskRepo as any, mockLlm as any);

      mockRepo.findAll.mockReturnValue(Promise.resolve([
        makeFluxItem({ entityType: "task", entityId: "t-1" }),
      ]));
      mockTaskRepo.findAll.mockReturnValue(Promise.resolve([
        makeTask({ id: "t-1", title: "Already triaged" }),
      ]));

      const result = await svc.suggestFlux();
      expect(result).toEqual([]);
      expect(mockLlm.chat).not.toHaveBeenCalled();
    });

    it("calls LLM with untriaged tasks and returns suggestions", async () => {
      const llmResponse = JSON.stringify([
        { id: "t-2", type: "task", status: "priority", reason: "Urgent bug" },
      ]);
      const mockLlm = { chat: mock(() => Promise.resolve(llmResponse)) };
      const svc = new FluxService(mockRepo as any, mockTaskRepo as any, mockLlm as any);

      mockRepo.findAll.mockReturnValue(Promise.resolve([]));
      mockTaskRepo.findAll.mockReturnValue(Promise.resolve([
        makeTask({ id: "t-2", title: "Critical bug" }),
      ]));

      const result = await svc.suggestFlux();
      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe("t-2");
      expect(result[0].suggestedStatus).toBe("priority");
      expect(result[0].reason).toBe("Urgent bug");
      expect(mockLlm.chat).toHaveBeenCalledTimes(1);
    });

    it("filters invalid statuses from LLM response", async () => {
      const llmResponse = JSON.stringify([
        { id: "t-1", type: "task", status: "priority", reason: "ok" },
        { id: "t-2", type: "task", status: "invalid_status", reason: "bad" },
      ]);
      const mockLlm = { chat: mock(() => Promise.resolve(llmResponse)) };
      const svc = new FluxService(mockRepo as any, mockTaskRepo as any, mockLlm as any);

      mockRepo.findAll.mockReturnValue(Promise.resolve([]));
      mockTaskRepo.findAll.mockReturnValue(Promise.resolve([
        makeTask({ id: "t-1", title: "Task 1" }),
        makeTask({ id: "t-2", title: "Task 2" }),
      ]));

      const result = await svc.suggestFlux();
      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe("t-1");
    });

    it("returns empty on LLM error", async () => {
      const mockLlm = { chat: mock(() => Promise.reject(new Error("API down"))) };
      const svc = new FluxService(mockRepo as any, mockTaskRepo as any, mockLlm as any);

      mockRepo.findAll.mockReturnValue(Promise.resolve([]));
      mockTaskRepo.findAll.mockReturnValue(Promise.resolve([
        makeTask({ id: "t-1", title: "Task" }),
      ]));

      const result = await svc.suggestFlux();
      expect(result).toEqual([]);
    });

    it("handles LLM response wrapped in code blocks", async () => {
      const llmResponse = "```json\n" + JSON.stringify([
        { id: "t-1", type: "task", status: "later", reason: "Not urgent" },
      ]) + "\n```";
      const mockLlm = { chat: mock(() => Promise.resolve(llmResponse)) };
      const svc = new FluxService(mockRepo as any, mockTaskRepo as any, mockLlm as any);

      mockRepo.findAll.mockReturnValue(Promise.resolve([]));
      mockTaskRepo.findAll.mockReturnValue(Promise.resolve([
        makeTask({ id: "t-1", title: "Task" }),
      ]));

      const result = await svc.suggestFlux();
      expect(result).toHaveLength(1);
      expect(result[0].suggestedStatus).toBe("later");
    });

    it("filters by entityType when provided", async () => {
      const mockLlm = { chat: mock(() => Promise.resolve("[]")) };
      const svc = new FluxService(mockRepo as any, mockTaskRepo as any, mockLlm as any);

      mockRepo.findAll.mockReturnValue(Promise.resolve([]));
      mockTaskRepo.findAll.mockReturnValue(Promise.resolve([]));

      await svc.suggestFlux("email");
      // Should NOT call taskRepo since we're filtering for email only
      expect(mockTaskRepo.findAll).not.toHaveBeenCalled();
    });
  });
});
