import { Hono } from "hono";
import { z } from "zod";

// ─── In-memory store (no DB needed — permissions are ephemeral) ───

export type PermissionBehavior = "allow" | "deny";

export interface PendingPermission {
  id: string;
  session_id: string;
  tool_name: string;
  tool_input: unknown;
  created_at: number;
  /** Set when resolved; null while waiting */
  behavior: PermissionBehavior | null;
  /** Internal resolver for long-polling */
  _resolve?: (b: PermissionBehavior) => void;
}

// ─── Routes ───

const createSchema = z.object({
  session_id: z.string().min(1).max(200),
  tool_name: z.string().min(1).max(100),
  tool_input: z.unknown(),
});

const resolveSchema = z.object({
  behavior: z.enum(["allow", "deny"]),
});

/**
 * Create the AI permissions routes.
 * @param store       Injectable store for unit tests. Defaults to a fresh Map.
 * @param timeoutMs   Long-poll timeout in ms before auto-deny. Default: 29 000.
 *                    Override in tests to avoid 29 s waits.
 */
export function createAiPermissionsRoutes(
  store?: Map<string, PendingPermission>,
  timeoutMs = 29_000,
) {
  const pending: Map<string, PendingPermission> =
    store ?? new Map<string, PendingPermission>();

  // Cleanup entries older than 2 minutes every 30s
  setInterval(() => {
    const cutoff = Date.now() - 120_000;
    for (const [id, entry] of pending) {
      if (entry.created_at < cutoff) {
        entry._resolve?.("deny"); // unblock any waiting GET
        pending.delete(id);
      }
    }
  }, 30_000).unref(); // unref so it doesn't keep the process alive in tests

  const app = new Hono();

  /**
   * POST /api/ai/permissions
   * Called by the MCP permission server when Claude CLI needs a decision.
   * Returns { id } immediately.
   */
  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
    }
    const { session_id, tool_name, tool_input } = parsed.data;
    const id = crypto.randomUUID();

    pending.set(id, {
      id,
      session_id,
      tool_name,
      tool_input,
      created_at: Date.now(),
      behavior: null,
    });

    return c.json({ id }, 201);
  });

  /**
   * GET /api/ai/permissions[?session_id=<id>]
   * Returns pending (unresolved) permission requests.
   * Optional ?session_id query param filters to a single session —
   * prevents cross-session contamination when multiple Cookia windows are open.
   */
  app.get("/", (c) => {
    const filterSession = c.req.query("session_id");
    const items = Array.from(pending.values())
      .filter((p) => p.behavior === null)
      .filter((p) => !filterSession || p.session_id === filterSession)
      .map(({ id, session_id, tool_name, tool_input, created_at }) => ({
        id, session_id, tool_name, tool_input, created_at,
      }));
    return c.json({ data: items });
  });

  /**
   * GET /api/ai/permissions/:id
   * Long-polls until the request is resolved or times out (29s → deny).
   * Called by the MCP permission server while waiting for the user.
   */
  app.get("/:id", async (c) => {
    const { id } = c.req.param();
    const entry = pending.get(id);
    if (!entry) return c.json({ error: "Not found" }, 404);

    // Already resolved (race: frontend was fast)
    if (entry.behavior !== null) {
      pending.delete(id);
      return c.json({ behavior: entry.behavior });
    }

    // Block until resolved or timeout (default 29s)
    const behavior = await new Promise<PermissionBehavior>((resolve) => {
      const timeout = setTimeout(() => resolve("deny"), timeoutMs);
      entry._resolve = (b) => {
        clearTimeout(timeout);
        resolve(b);
      };
    });

    pending.delete(id);
    return c.json({ behavior });
  });

  /**
   * POST /api/ai/permissions/:id/resolve
   * Called by the frontend when the user clicks Allow or Deny.
   */
  app.post("/:id/resolve", async (c) => {
    const { id } = c.req.param();
    const entry = pending.get(id);
    if (!entry) return c.json({ error: "Not found" }, 404);

    const body = await c.req.json().catch(() => null);
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid body" }, 400);
    }

    entry.behavior = parsed.data.behavior;
    entry._resolve?.(parsed.data.behavior);

    return c.json({ ok: true });
  });

  return app;
}
