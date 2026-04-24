import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import { createTaskRoutes } from "../../presentation/routes/task.routes";
import type { TaskService } from "../../application/task/task.service";
import type { TaskDetailService } from "../../application/task/task-detail.service";
import type { Task } from "../../domain/task/task.entity";

// --- Factory ---

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    externalId: null,
    source: "manual",
    title: "Fix login bug",
    description: "The login form crashes on submit",
    status: "open",
    priority: "high",
    url: null,
    labels: ["bug"],
    assignees: ["alice"],
    dueDate: new Date("2026-04-15T00:00:00Z"),
    startDate: null,
    metadata: null,
    createdAt: new Date("2026-04-01T10:00:00Z"),
    updatedAt: new Date("2026-04-01T10:00:00Z"),
    ...overrides,
  };
}

// --- Mocks ---

function createMockTaskService() {
  return {
    getAll: mock(() => Promise.resolve([])),
    count: mock(() => Promise.resolve(0)),
    getById: mock(() => Promise.resolve(null)),
    getByExternalId: mock(() => Promise.resolve(null)),
    getUnscheduled: mock(() => Promise.resolve([])),
    countUnscheduled: mock(() => Promise.resolve(0)),
    create: mock(() => Promise.resolve(makeTask())),
    update: mock(() => Promise.resolve(null)),
  };
}

function createMockTaskDetailService() {
  return {
    getDetail: mock(() => Promise.resolve(null as { description: string | null; comments: unknown[] } | null)),
  };
}

// --- Tests ---

describe("Task Routes", () => {
  let app: Hono;
  let mockService: ReturnType<typeof createMockTaskService>;
  let mockDetailService: ReturnType<typeof createMockTaskDetailService>;

  beforeEach(() => {
    mockService = createMockTaskService();
    mockDetailService = createMockTaskDetailService();
    app = new Hono();
    app.route(
      "/api/tasks",
      createTaskRoutes(
        mockService as unknown as TaskService,
        mockDetailService as unknown as TaskDetailService,
      ),
    );
  });

  // --- GET /api/tasks ---

  describe("GET /api/tasks", () => {
    it("returns all tasks", async () => {
      const tasks = [makeTask(), makeTask({ id: "task-2", title: "Write tests" })];
      mockService.getAll.mockReturnValue(Promise.resolve(tasks));

      const res = await app.request("/api/tasks");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(2);
      expect(json.data[0].title).toBe("Fix login bug");
      expect(json.data[1].title).toBe("Write tests");
      expect(mockService.getAll).toHaveBeenCalledTimes(1);
    });

    it("returns filtered tasks when ?source=github", async () => {
      const ghTask = makeTask({ id: "gh-1", source: "github", title: "GH issue" });
      mockService.getAll.mockReturnValue(Promise.resolve([ghTask]));

      const res = await app.request("/api/tasks?source=github");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].source).toBe("github");
      expect(mockService.getAll.mock.calls[0][0].source).toBe("github");
    });
  });

  // --- POST /api/tasks ---

  describe("POST /api/tasks", () => {
    it("creates a manual task and returns 201", async () => {
      const created = makeTask({ title: "New task", description: "desc" });
      mockService.create.mockReturnValue(Promise.resolve(created));

      const res = await app.request("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New task",
          description: "desc",
          status: "open",
          priority: "medium",
          labels: ["feature"],
          assignees: ["bob"],
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.title).toBe("New task");
      expect(mockService.create).toHaveBeenCalledTimes(1);

      const callArg = mockService.create.mock.calls[0][0];
      expect(callArg.source).toBe("manual");
      expect(callArg.title).toBe("New task");
      expect(callArg.description).toBe("desc");
      expect(callArg.priority).toBe("medium");
      expect(callArg.labels).toEqual(["feature"]);
      expect(callArg.assignees).toEqual(["bob"]);
    });

    it("applies defaults for optional fields", async () => {
      mockService.create.mockReturnValue(Promise.resolve(makeTask()));

      await app.request("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Minimal" }),
      });

      const callArg = mockService.create.mock.calls[0][0];
      expect(callArg.description).toBeNull();
      expect(callArg.status).toBe("open");
      expect(callArg.priority).toBeNull();
      expect(callArg.labels).toEqual([]);
      expect(callArg.assignees).toEqual([]);
      expect(callArg.dueDate).toBeNull();
      expect(callArg.startDate).toBeNull();
    });
  });

  // --- GET /api/tasks/unscheduled ---

  describe("GET /api/tasks/unscheduled", () => {
    it("returns unscheduled tasks", async () => {
      const tasks = [makeTask({ id: "u-1", dueDate: null }), makeTask({ id: "u-2", dueDate: null })];
      mockService.getUnscheduled.mockReturnValue(Promise.resolve(tasks));

      const res = await app.request("/api/tasks/unscheduled");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(2);
      expect(mockService.getUnscheduled).toHaveBeenCalledTimes(1);
    });
  });

  // --- GET /api/tasks/:id ---

  describe("GET /api/tasks/:id", () => {
    it("returns task when found", async () => {
      mockService.getById.mockReturnValue(Promise.resolve(makeTask()));

      const res = await app.request("/api/tasks/task-1");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.id).toBe("task-1");
      expect(json.data.title).toBe("Fix login bug");
    });

    it("returns 404 when task not found", async () => {
      mockService.getById.mockReturnValue(Promise.resolve(null));

      const res = await app.request("/api/tasks/nonexistent");
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Task not found");
    });
  });

  // --- PATCH /api/tasks/:id ---

  describe("PATCH /api/tasks/:id", () => {
    it("updates task and returns updated data", async () => {
      const updated = makeTask({ title: "Updated title", status: "done" });
      mockService.update.mockReturnValue(Promise.resolve(updated));

      const res = await app.request("/api/tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated title", status: "done" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.title).toBe("Updated title");
      expect(json.data.status).toBe("done");
      expect(mockService.update).toHaveBeenCalledTimes(1);
      expect(mockService.update.mock.calls[0][0]).toBe("task-1");
    });

    it("returns 404 when updating nonexistent task", async () => {
      mockService.update.mockReturnValue(Promise.resolve(null));

      const res = await app.request("/api/tasks/ghost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nope" }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Task not found");
    });
  });

  // --- GET /api/tasks/:id/detail ---

  describe("GET /api/tasks/:id/detail", () => {
    it("returns description and empty comments for manual task", async () => {
      mockDetailService.getDetail.mockReturnValue(
        Promise.resolve({ description: "Some detailed description", comments: [] }),
      );

      const res = await app.request("/api/tasks/task-1/detail");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.description).toBe("Some detailed description");
      expect(json.data.comments).toEqual([]);
    });

    it("returns 404 for nonexistent task", async () => {
      mockDetailService.getDetail.mockReturnValue(Promise.resolve(null));

      const res = await app.request("/api/tasks/ghost/detail");
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Task not found");
    });

    it("falls back to description + empty comments when external config is missing", async () => {
      mockDetailService.getDetail.mockReturnValue(
        Promise.resolve({ description: "Fallback desc", comments: [] }),
      );

      const res = await app.request("/api/tasks/task-1/detail");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.description).toBe("Fallback desc");
      expect(json.data.comments).toEqual([]);
    });
  });
});
