import { describe, it, expect, beforeEach, mock } from "bun:test";
import { TriageService } from "../../application/triage/triage.service";
import type { TriageRepository } from "../../domain/triage/triage.repository";
import type { TaskTriage, SetTriageInput } from "../../domain/triage/triage.entity";

const makeTriage = (overrides: Partial<TaskTriage> = {}): TaskTriage => ({
  id: "tri-1",
  clickupTaskId: "task-1",
  triageStatus: "priority",
  triagedAt: new Date("2026-03-15T08:00:00Z"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("TriageService", () => {
  let service: TriageService;
  let mockRepo: Record<keyof TriageRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findByStatus: mock(() => Promise.resolve([])),
      findByClickupTaskId: mock(() => Promise.resolve(null)),
      upsert: mock(() => Promise.resolve(makeTriage())),
      bulkUpsert: mock(() => Promise.resolve()),
      deleteByClickupTaskId: mock(() => Promise.resolve()),
      deleteAll: mock(() => Promise.resolve()),
    };
    service = new TriageService(mockRepo as unknown as TriageRepository);
  });

  describe("getAll", () => {
    it("should return all triages from repository", async () => {
      const triages = [makeTriage(), makeTriage({ id: "tri-2", clickupTaskId: "task-2" })];
      mockRepo.findAll.mockReturnValue(Promise.resolve(triages));

      const result = await service.getAll();

      expect(result).toEqual(triages);
      expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when no triages exist", async () => {
      const result = await service.getAll();

      expect(result).toEqual([]);
    });
  });

  describe("getByStatus", () => {
    it("should return triages filtered by status", async () => {
      const triages = [makeTriage({ triageStatus: "later" })];
      mockRepo.findByStatus.mockReturnValue(Promise.resolve(triages));

      const result = await service.getByStatus("later");

      expect(result).toEqual(triages);
      expect(mockRepo.findByStatus).toHaveBeenCalledWith("later");
    });

    it("should return empty array when no triages match the status", async () => {
      const result = await service.getByStatus("archived");

      expect(result).toEqual([]);
      expect(mockRepo.findByStatus).toHaveBeenCalledWith("archived");
    });
  });

  describe("setTriage", () => {
    it("should upsert a triage and return the result", async () => {
      const input: SetTriageInput = { clickupTaskId: "task-1", triageStatus: "priority" };
      const created = makeTriage(input);
      mockRepo.upsert.mockReturnValue(Promise.resolve(created));

      const result = await service.setTriage(input);

      expect(result).toEqual(created);
      expect(mockRepo.upsert).toHaveBeenCalledWith(input);
    });

    it("should handle updating an existing triage to a new status", async () => {
      const input: SetTriageInput = { clickupTaskId: "task-1", triageStatus: "dismissed" };
      const updated = makeTriage({ ...input, updatedAt: new Date("2026-03-15") });
      mockRepo.upsert.mockReturnValue(Promise.resolve(updated));

      const result = await service.setTriage(input);

      expect(result).toEqual(updated);
      expect(mockRepo.upsert).toHaveBeenCalledWith(input);
    });
  });

  describe("bulkSetTriage", () => {
    it("should bulk upsert multiple triages", async () => {
      const inputs: SetTriageInput[] = [
        { clickupTaskId: "task-1", triageStatus: "priority" },
        { clickupTaskId: "task-2", triageStatus: "later" },
        { clickupTaskId: "task-3", triageStatus: "archived" },
      ];

      await service.bulkSetTriage(inputs);

      expect(mockRepo.bulkUpsert).toHaveBeenCalledWith(inputs);
      expect(mockRepo.bulkUpsert).toHaveBeenCalledTimes(1);
    });

    it("should handle empty inputs array", async () => {
      await service.bulkSetTriage([]);

      expect(mockRepo.bulkUpsert).toHaveBeenCalledWith([]);
    });
  });

  describe("resetTriage", () => {
    it("should delete triage by clickup task id", async () => {
      await service.resetTriage("task-1");

      expect(mockRepo.deleteByClickupTaskId).toHaveBeenCalledWith("task-1");
      expect(mockRepo.deleteByClickupTaskId).toHaveBeenCalledTimes(1);
    });
  });

  describe("resetAll", () => {
    it("should delete all triages", async () => {
      await service.resetAll();

      expect(mockRepo.deleteAll).toHaveBeenCalledTimes(1);
    });
  });
});
