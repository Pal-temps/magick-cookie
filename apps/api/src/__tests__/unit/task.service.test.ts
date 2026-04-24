import { describe, it, expect, beforeEach, mock } from "bun:test";
import { TaskService } from "../../application/task/task.service";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { Task, CreateTaskInput, UpdateTaskInput } from "../../domain/task/task.entity";

const now = new Date("2026-04-01");

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "t-1",
  externalId: null,
  source: "manual",
  title: "Fix bug",
  description: null,
  status: "open",
  priority: null,
  url: null,
  labels: [],
  assignees: [],
  dueDate: null,
  startDate: null,
  metadata: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe("TaskService", () => {
  let service: TaskService;
  let mockRepo: Record<keyof TaskRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findByExternalId: mock(() => Promise.resolve(null)),
      findBySource: mock(() => Promise.resolve([])),
      findUnscheduled: mock(() => Promise.resolve([])),
      upsertByExternalId: mock(() => Promise.resolve(makeTask())),
      create: mock(() => Promise.resolve(makeTask())),
      update: mock(() => Promise.resolve(null)),
      deleteBySource: mock(() => Promise.resolve()),
      deleteNotInExternalIds: mock(() => Promise.resolve()),
      delete: mock(() => Promise.resolve(true)),
    };
    service = new TaskService(mockRepo as any);
  });

  describe("getAll", () => {
    it("returns all tasks from repo", async () => {
      const tasks = [makeTask(), makeTask({ id: "t-2", title: "Add feature" })];
      mockRepo.findAll.mockReturnValue(Promise.resolve(tasks));

      const result = await service.getAll();
      expect(result).toHaveLength(2);
      expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when no tasks", async () => {
      const result = await service.getAll();
      expect(result).toEqual([]);
    });
  });

  describe("create", () => {
    it("creates a task and returns it", async () => {
      const input: CreateTaskInput = { source: "manual", title: "New task" };
      const created = makeTask({ title: "New task" });
      mockRepo.create.mockReturnValue(Promise.resolve(created));

      const result = await service.create(input);
      expect(result.title).toBe("New task");
      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });
  });

  describe("getBySource", () => {
    it("returns tasks filtered by source", async () => {
      const githubTasks = [
        makeTask({ id: "t-gh-1", source: "github", title: "PR review" }),
      ];
      mockRepo.findBySource.mockReturnValue(Promise.resolve(githubTasks));

      const result = await service.getBySource("github");
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe("github");
      expect(mockRepo.findBySource).toHaveBeenCalledWith("github");
    });
  });

  describe("getUnscheduled", () => {
    it("returns tasks with no due date", async () => {
      const tasks = [makeTask({ dueDate: null })];
      mockRepo.findUnscheduled.mockReturnValue(Promise.resolve(tasks));

      const result = await service.getUnscheduled();
      expect(result).toHaveLength(1);
      expect(result[0].dueDate).toBeNull();
    });
  });

  describe("getById", () => {
    it("returns task when found", async () => {
      mockRepo.findById.mockReturnValue(Promise.resolve(makeTask()));

      const result = await service.getById("t-1");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("t-1");
      expect(mockRepo.findById).toHaveBeenCalledWith("t-1");
    });

    it("returns null when not found", async () => {
      const result = await service.getById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getByExternalId", () => {
    it("returns task by external id and source", async () => {
      const task = makeTask({ externalId: "ext-123", source: "clickup" });
      mockRepo.findByExternalId.mockReturnValue(Promise.resolve(task));

      const result = await service.getByExternalId("ext-123", "clickup");
      expect(result).not.toBeNull();
      expect(result!.externalId).toBe("ext-123");
      expect(mockRepo.findByExternalId).toHaveBeenCalledWith("ext-123", "clickup");
    });

    it("returns null when not found", async () => {
      const result = await service.getByExternalId("nope", "github");
      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("returns updated task", async () => {
      const input: UpdateTaskInput = { title: "Updated title", status: "done" };
      const updated = makeTask({ title: "Updated title", status: "done" });
      mockRepo.update.mockReturnValue(Promise.resolve(updated));

      const result = await service.update("t-1", input);
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Updated title");
      expect(result!.status).toBe("done");
      expect(mockRepo.update).toHaveBeenCalledWith("t-1", input);
    });

    it("returns null when task not found", async () => {
      const input: UpdateTaskInput = { title: "Nope" };

      const result = await service.update("nonexistent", input);
      expect(result).toBeNull();
      expect(mockRepo.update).toHaveBeenCalledWith("nonexistent", input);
    });
  });
});
