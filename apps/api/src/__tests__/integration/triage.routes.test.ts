import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import { createTriageRoutes } from "../../presentation/routes/triage.routes";
import type { TriageService } from "../../application/triage/triage.service";
import type { TaskTriage } from "../../domain/triage/triage.entity";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTriage(overrides: Partial<TaskTriage> = {}): TaskTriage {
  return {
    id: "triage-1",
    clickupTaskId: "abc123",
    triageStatus: "priority",
    triagedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildApp(service: TriageService) {
  const app = new Hono();
  app.route("/api/triage", createTriageRoutes(service));
  return app;
}

function request(
  app: Hono,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
) {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

// ---------------------------------------------------------------------------
// Mock service factory
// ---------------------------------------------------------------------------

function createMockService(): TriageService {
  return {
    getAll: mock(() => Promise.resolve([])),
    getByStatus: mock(() => Promise.resolve([])),
    setTriage: mock(() => Promise.resolve(makeTriage())),
    bulkSetTriage: mock(() => Promise.resolve()),
    resetTriage: mock(() => Promise.resolve()),
    resetAll: mock(() => Promise.resolve()),
  } as unknown as TriageService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Triage routes", () => {
  let service: ReturnType<typeof createMockService>;
  let app: Hono;

  beforeEach(() => {
    service = createMockService();
    app = buildApp(service);
  });

  // ----------------------------------------------------------------
  // GET /api/triage
  // ----------------------------------------------------------------
  describe("GET /api/triage", () => {
    test("returns all triage decisions", async () => {
      const items = [makeTriage(), makeTriage({ id: "triage-2", clickupTaskId: "def456" })];
      (service.getAll as ReturnType<typeof mock>).mockResolvedValue(items);

      const res = await request(app, "GET", "/api/triage");

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data).toHaveLength(2);
      expect(service.getAll).toHaveBeenCalledTimes(1);
      expect(service.getByStatus).not.toHaveBeenCalled();
    });

    test("filters by status when query param provided", async () => {
      const items = [makeTriage({ triageStatus: "later" })];
      (service.getByStatus as ReturnType<typeof mock>).mockResolvedValue(items);

      const res = await request(app, "GET", "/api/triage?status=later");

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data).toHaveLength(1);
      expect(service.getByStatus).toHaveBeenCalledWith("later");
      expect(service.getAll).not.toHaveBeenCalled();
    });

    test("ignores invalid status and returns all", async () => {
      (service.getAll as ReturnType<typeof mock>).mockResolvedValue([]);

      const res = await request(app, "GET", "/api/triage?status=invalid");

      expect(res.status).toBe(200);
      expect(service.getAll).toHaveBeenCalledTimes(1);
      expect(service.getByStatus).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // POST /api/triage
  // ----------------------------------------------------------------
  describe("POST /api/triage", () => {
    test("creates a triage decision", async () => {
      const created = makeTriage({ clickupTaskId: "task-1", triageStatus: "priority" });
      (service.setTriage as ReturnType<typeof mock>).mockResolvedValue(created);

      const res = await request(app, "POST", "/api/triage", {
        clickupTaskId: "task-1",
        triageStatus: "priority",
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.clickupTaskId).toBe("task-1");
      expect(data.triageStatus).toBe("priority");
      expect(service.setTriage).toHaveBeenCalledWith({
        clickupTaskId: "task-1",
        triageStatus: "priority",
      });
    });

    test("returns 400 when clickupTaskId is missing", async () => {
      const res = await request(app, "POST", "/api/triage", {
        triageStatus: "priority",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid input");
      expect(service.setTriage).not.toHaveBeenCalled();
    });

    test("returns 400 when triageStatus is invalid", async () => {
      const res = await request(app, "POST", "/api/triage", {
        clickupTaskId: "task-1",
        triageStatus: "bogus",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid input");
      expect(service.setTriage).not.toHaveBeenCalled();
    });

    test("returns 400 when triageStatus is missing", async () => {
      const res = await request(app, "POST", "/api/triage", {
        clickupTaskId: "task-1",
      });

      expect(res.status).toBe(400);
      expect(service.setTriage).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // POST /api/triage/bulk
  // ----------------------------------------------------------------
  describe("POST /api/triage/bulk", () => {
    test("saves valid bulk entries", async () => {
      const res = await request(app, "POST", "/api/triage/bulk", {
        items: [
          { clickupTaskId: "t1", triageStatus: "priority" },
          { clickupTaskId: "t2", triageStatus: "later" },
        ],
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.saved).toBe(2);
      expect(service.bulkSetTriage).toHaveBeenCalledWith([
        { clickupTaskId: "t1", triageStatus: "priority" },
        { clickupTaskId: "t2", triageStatus: "later" },
      ]);
    });

    test("filters out invalid items from bulk", async () => {
      const res = await request(app, "POST", "/api/triage/bulk", {
        items: [
          { clickupTaskId: "t1", triageStatus: "priority" },
          { clickupTaskId: "", triageStatus: "later" },       // empty id
          { clickupTaskId: "t3", triageStatus: "nope" },       // bad status
          { clickupTaskId: "t4", triageStatus: "archived" },
        ],
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.saved).toBe(2);
      expect(service.bulkSetTriage).toHaveBeenCalledWith([
        { clickupTaskId: "t1", triageStatus: "priority" },
        { clickupTaskId: "t4", triageStatus: "archived" },
      ]);
    });

    test("returns 400 when items is not an array", async () => {
      const res = await request(app, "POST", "/api/triage/bulk", {
        items: "not-an-array",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid input");
      expect(service.bulkSetTriage).not.toHaveBeenCalled();
    });

    test("saves zero when all items are invalid", async () => {
      const res = await request(app, "POST", "/api/triage/bulk", {
        items: [
          { clickupTaskId: "", triageStatus: "bad" },
        ],
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.saved).toBe(0);
      expect(service.bulkSetTriage).toHaveBeenCalledWith([]);
    });
  });

  // ----------------------------------------------------------------
  // DELETE /api/triage/:clickupTaskId
  // ----------------------------------------------------------------
  describe("DELETE /api/triage/:clickupTaskId", () => {
    test("resets triage for a single task", async () => {
      const res = await request(app, "DELETE", "/api/triage/task-42");

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.ok).toBe(true);
      expect(service.resetTriage).toHaveBeenCalledWith("task-42");
    });
  });

  // ----------------------------------------------------------------
  // DELETE /api/triage
  // ----------------------------------------------------------------
  describe("DELETE /api/triage", () => {
    test("resets all triage decisions", async () => {
      const res = await request(app, "DELETE", "/api/triage");

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.ok).toBe(true);
      expect(service.resetAll).toHaveBeenCalledTimes(1);
    });
  });
});
