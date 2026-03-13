import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { ClickUpApiClient } from "../../infrastructure/connectors/clickup-api.client";

const TOKEN = "pk_test_token";

// --- Helpers ---

function makeRawTask(overrides: Record<string, any> = {}) {
  return {
    id: "abc123",
    name: "Raw Task",
    description: "Some desc",
    status: { status: "open" },
    due_date: "1711929600000", // 2024-04-01T12:00:00Z
    start_date: "1711900800000", // 2024-04-01T04:00:00Z
    url: "https://app.clickup.com/t/abc123",
    list: { name: "Sprint Backlog" },
    space: { id: "space-42" },
    priority: { priority: "high" },
    assignees: [{ username: "alice" }, { username: "bob" }],
    ...overrides,
  };
}

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- Tests ---

describe("ClickUpApiClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should fetch teams and paginate tasks", async () => {
    const client = new ClickUpApiClient(TOKEN);

    const page0Tasks = [makeRawTask({ id: "t1" }), makeRawTask({ id: "t2" })];
    const page1Tasks = [makeRawTask({ id: "t3" })];

    global.fetch = mock((url: string | URL | Request) => {
      const u = url.toString();
      if (u.endsWith("/user")) {
        return Promise.resolve(jsonResponse({ user: { id: 123 } }));
      }
      if (u.includes("/team") && !u.includes("/task")) {
        return Promise.resolve(jsonResponse({ teams: [{ id: "team-1", name: "Workspace" }] }));
      }
      if (u.includes("page=0")) {
        return Promise.resolve(jsonResponse({ tasks: page0Tasks }));
      }
      if (u.includes("page=1")) {
        return Promise.resolve(jsonResponse({ tasks: page1Tasks }));
      }
      if (u.includes("page=2")) {
        return Promise.resolve(jsonResponse({ tasks: [] }));
      }
      return Promise.resolve(jsonResponse({ tasks: [] }));
    }) as any;

    const tasks = await client.fetchAllTasks();
    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("should stop paginating when empty page returned", async () => {
    const client = new ClickUpApiClient(TOKEN);

    const page0Tasks = [makeRawTask({ id: "t1" })];
    let fetchCallCount = 0;

    global.fetch = mock((url: string | URL | Request) => {
      fetchCallCount++;
      const u = url.toString();
      if (u.endsWith("/user")) {
        return Promise.resolve(jsonResponse({ user: { id: 123 } }));
      }
      if (u.includes("/team") && !u.includes("/task")) {
        return Promise.resolve(jsonResponse({ teams: [{ id: "team-1", name: "W" }] }));
      }
      if (u.includes("page=0")) {
        return Promise.resolve(jsonResponse({ tasks: page0Tasks }));
      }
      // page=1 returns empty → should stop
      return Promise.resolve(jsonResponse({ tasks: [] }));
    }) as any;

    const tasks = await client.fetchAllTasks();
    expect(tasks).toHaveLength(1);
    // 1 call for user + 1 for teams + 1 for page 0 + 1 for page 1 (empty, stops pagination)
    expect(fetchCallCount).toBe(4);
  });

  it("should map raw API response to ClickUpTask", async () => {
    const client = new ClickUpApiClient(TOKEN);

    const raw = makeRawTask({
      id: "mapped-1",
      name: "Mapped",
      description: "desc here",
      due_date: "1711929600000",
      start_date: "1711900800000",
      priority: { priority: "urgent" },
      assignees: [{ username: "charlie" }],
    });

    global.fetch = mock((url: string | URL | Request) => {
      const u = url.toString();
      if (u.endsWith("/user")) {
        return Promise.resolve(jsonResponse({ user: { id: 123 } }));
      }
      if (u.includes("/team") && !u.includes("/task")) {
        return Promise.resolve(jsonResponse({ teams: [{ id: "t1", name: "T" }] }));
      }
      if (u.includes("page=0")) {
        return Promise.resolve(jsonResponse({ tasks: [raw] }));
      }
      return Promise.resolve(jsonResponse({ tasks: [] }));
    }) as any;

    const tasks = await client.fetchAllTasks();
    expect(tasks).toHaveLength(1);

    const task = tasks[0];
    expect(task.id).toBe("mapped-1");
    expect(task.name).toBe("Mapped");
    expect(task.description).toBe("desc here");
    expect(task.status).toBe("open");
    expect(task.dueDate).toEqual(new Date(1711929600000));
    expect(task.startDate).toEqual(new Date(1711900800000));
    expect(task.url).toBe("https://app.clickup.com/t/abc123");
    expect(task.listName).toBe("Sprint Backlog");
    expect(task.spaceName).toBe("space-42");
    expect(task.priority).toBe("urgent");
    expect(task.assignees).toEqual(["charlie"]);
  });

  it("should handle tasks with null due_date", async () => {
    const client = new ClickUpApiClient(TOKEN);

    const raw = makeRawTask({ id: "null-due", due_date: null, start_date: null });

    global.fetch = mock((url: string | URL | Request) => {
      const u = url.toString();
      if (u.endsWith("/user")) {
        return Promise.resolve(jsonResponse({ user: { id: 123 } }));
      }
      if (u.includes("/team") && !u.includes("/task")) {
        return Promise.resolve(jsonResponse({ teams: [{ id: "t1", name: "T" }] }));
      }
      if (u.includes("page=0")) {
        return Promise.resolve(jsonResponse({ tasks: [raw] }));
      }
      return Promise.resolve(jsonResponse({ tasks: [] }));
    }) as any;

    const tasks = await client.fetchAllTasks();
    const task = tasks[0];
    expect(task.dueDate).toBeNull();
    expect(task.startDate).toBeNull();
  });

  it("should combine tasks from multiple workspaces", async () => {
    const client = new ClickUpApiClient(TOKEN);

    global.fetch = mock((url: string | URL | Request) => {
      const u = url.toString();
      if (u.endsWith("/user")) {
        return Promise.resolve(jsonResponse({ user: { id: 123 } }));
      }
      if (u.includes("/team") && !u.includes("/task")) {
        return Promise.resolve(
          jsonResponse({
            teams: [
              { id: "ws-a", name: "Workspace A" },
              { id: "ws-b", name: "Workspace B" },
            ],
          }),
        );
      }
      // Workspace A tasks
      if (u.includes("/team/ws-a/task") && u.includes("page=0")) {
        return Promise.resolve(jsonResponse({ tasks: [makeRawTask({ id: "a1" })] }));
      }
      // Workspace B tasks
      if (u.includes("/team/ws-b/task") && u.includes("page=0")) {
        return Promise.resolve(jsonResponse({ tasks: [makeRawTask({ id: "b1" }), makeRawTask({ id: "b2" })] }));
      }
      // Empty pages for both
      return Promise.resolve(jsonResponse({ tasks: [] }));
    }) as any;

    const tasks = await client.fetchAllTasks();
    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.id)).toEqual(["a1", "b1", "b2"]);
  });
});
