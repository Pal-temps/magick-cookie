import { describe, it, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import {
  createAiPermissionsRoutes,
  type PendingPermission,
  type PermissionBehavior,
} from "../../presentation/routes/ai-permissions.routes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a fresh isolated app + store for each test */
function makeApp() {
  const store = new Map<string, PendingPermission>();
  const routes = createAiPermissionsRoutes(store);
  const app = new Hono();
  app.route("/", routes);
  return { app, store };
}

async function json(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST / — create permission request", () => {
  it("returns 201 with a UUID id", async () => {
    const { app } = makeApp();
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: "sess-1",
        tool_name: "Write",
        tool_input: { file_path: "/tmp/foo.txt" },
      }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(typeof body.id).toBe("string");
    expect((body.id as string).length).toBeGreaterThan(0);
  });

  it("stores the entry in pending with behavior=null", async () => {
    const { app, store } = makeApp();
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: "sess-2",
        tool_name: "Bash",
        tool_input: { command: "rm -rf /tmp/test" },
      }),
    });
    const { id } = (await json(res)) as { id: string };
    const entry = store.get(id);
    expect(entry).toBeDefined();
    expect(entry!.behavior).toBeNull();
    expect(entry!.tool_name).toBe("Bash");
    expect(entry!.session_id).toBe("sess-2");
  });

  it("returns 400 when session_id is missing", async () => {
    const { app } = makeApp();
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_name: "Write", tool_input: {} }),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toBe("Invalid body");
  });

  it("returns 400 when tool_name is missing", async () => {
    const { app } = makeApp();
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s", tool_input: {} }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not JSON", async () => {
    const { app } = makeApp();
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
  });
});

describe("GET / — list pending permissions", () => {
  it("returns empty array when no requests pending", async () => {
    const { app } = makeApp();
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([]);
  });

  it("filters by session_id query param", async () => {
    const { app } = makeApp();

    // Create two requests for different sessions
    const postA = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "session-A", tool_name: "Write", tool_input: {} }),
    });
    await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "session-B", tool_name: "Bash", tool_input: {} }),
    });
    const { id: idA } = (await json(postA)) as { id: string };

    // ?session_id=session-A should only return that session's request
    const resA = await app.request("/?session_id=session-A");
    const { data: dataA } = (await resA.json()) as { data: { id: string; session_id: string }[] };
    expect(dataA).toHaveLength(1);
    expect(dataA[0].id).toBe(idA);
    expect(dataA[0].session_id).toBe("session-A");

    // ?session_id=session-C (no match) → empty
    const resC = await app.request("/?session_id=session-C");
    const { data: dataC } = (await resC.json()) as { data: unknown[] };
    expect(dataC).toHaveLength(0);

    // No filter → both
    const resAll = await app.request("/");
    const { data: dataAll } = (await resAll.json()) as { data: unknown[] };
    expect(dataAll).toHaveLength(2);
  });

  it("returns pending items without resolved ones", async () => {
    const { app, store } = makeApp();

    // Create two pending
    const post1 = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s1", tool_name: "Write", tool_input: {} }),
    });
    const post2 = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s2", tool_name: "Bash", tool_input: {} }),
    });
    const { id: id1 } = (await json(post1)) as { id: string };
    const { id: id2 } = (await json(post2)) as { id: string };

    // Manually mark id1 as resolved (simulate resolve)
    const entry1 = store.get(id1)!;
    entry1.behavior = "allow";

    const listRes = await app.request("/");
    const { data } = (await listRes.json()) as { data: PendingPermission[] };
    const ids = data.map((p) => p.id);
    expect(ids).not.toContain(id1);
    expect(ids).toContain(id2);
  });

  it("does not expose _resolve in the response", async () => {
    const { app } = makeApp();
    await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s", tool_name: "Read", tool_input: {} }),
    });
    const listRes = await app.request("/");
    const { data } = (await listRes.json()) as { data: Record<string, unknown>[] };
    for (const item of data) {
      expect(item._resolve).toBeUndefined();
    }
  });
});

describe("GET /:id — long-poll for decision", () => {
  it("returns 404 for unknown id", async () => {
    const { app } = makeApp();
    const res = await app.request("/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("returns immediately when already resolved before GET", async () => {
    const { app, store } = makeApp();

    // Create + pre-resolve
    const postRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s", tool_name: "Write", tool_input: {} }),
    });
    const { id } = (await json(postRes)) as { id: string };
    store.get(id)!.behavior = "allow";

    const getRes = await app.request(`/${id}`);
    expect(getRes.status).toBe(200);
    const body = await json(getRes);
    expect(body.behavior).toBe("allow");

    // Entry should be cleaned up
    expect(store.has(id)).toBe(false);
  });

  it("unblocks when POST /resolve is called concurrently (allow)", async () => {
    const { app } = makeApp();

    const postRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s", tool_name: "Bash", tool_input: { command: "ls" } }),
    });
    const { id } = (await json(postRes)) as { id: string };

    // Start long-poll and resolve concurrently
    const longPollPromise = app.request(`/${id}`);

    // Resolve after a tick
    await Promise.resolve();
    const resolveRes = await app.request(`/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ behavior: "allow" }),
    });
    expect(resolveRes.status).toBe(200);

    const pollBody = await json(await longPollPromise);
    expect(pollBody.behavior).toBe("allow");
  });

  it("unblocks with deny when POST /resolve sends deny", async () => {
    const { app } = makeApp();

    const postRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s", tool_name: "WebFetch", tool_input: { url: "https://evil.com" } }),
    });
    const { id } = (await json(postRes)) as { id: string };

    const longPollPromise = app.request(`/${id}`);

    await Promise.resolve();
    await app.request(`/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ behavior: "deny" }),
    });

    const pollBody = await json(await longPollPromise);
    expect(pollBody.behavior).toBe("deny");
  });
});

describe("POST /:id/resolve — user decision", () => {
  it("returns 404 for unknown id", async () => {
    const { app } = makeApp();
    const res = await app.request("/00000000-0000-0000-0000-000000000001/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ behavior: "allow" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid behavior value", async () => {
    const { app } = makeApp();

    const postRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s", tool_name: "Edit", tool_input: {} }),
    });
    const { id } = (await json(postRes)) as { id: string };

    const res = await app.request(`/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ behavior: "maybe" }),
    });
    expect(res.status).toBe(400);
  });

  it("sets behavior on the entry", async () => {
    const { app, store } = makeApp();

    const postRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s", tool_name: "Glob", tool_input: {} }),
    });
    const { id } = (await json(postRes)) as { id: string };

    await app.request(`/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ behavior: "deny" }),
    });

    expect(store.get(id)?.behavior).toBe("deny");
  });

  it("returns { ok: true } on success", async () => {
    const { app } = makeApp();

    const postRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s", tool_name: "Read", tool_input: {} }),
    });
    const { id } = (await json(postRes)) as { id: string };

    const res = await app.request(`/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ behavior: "allow" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.ok).toBe(true);
  });
});

describe("Full round-trip: create → list → long-poll → resolve", () => {
  it("completes the full allow flow", async () => {
    const { app } = makeApp();

    // 1. Create
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: "session-xyz",
        tool_name: "Write",
        tool_input: { file_path: "/home/user/notes.md", content: "Hello" },
      }),
    });
    expect(createRes.status).toBe(201);
    const { id } = (await json(createRes)) as { id: string };

    // 2. List: item appears
    const listRes = await app.request("/");
    const { data } = (await listRes.json()) as { data: { id: string }[] };
    expect(data.some((p) => p.id === id)).toBe(true);

    // 3. Long-poll + resolve concurrently
    const longPollP = app.request(`/${id}`);

    await Promise.resolve();
    await app.request(`/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ behavior: "allow" }),
    });

    const pollBody = await json(await longPollP);
    expect(pollBody.behavior).toBe("allow");

    // 4. Entry is gone from pending
    const listRes2 = await app.request("/");
    const { data: data2 } = (await listRes2.json()) as { data: { id: string }[] };
    expect(data2.some((p) => p.id === id)).toBe(false);
  });
});
