import { Hono } from "hono";

interface RelayEntry {
  token: string;
  callbackUrl: string;
  registeredAt: number;
}

export function createRelayRoutes() {
  const app = new Hono();
  // In-memory store per factory call (one per server instance)
  const store = new Map<string, RelayEntry>();

  app.post("/register", async (c) => {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const { token, callbackUrl } = body;
    if (!token || typeof token !== "string") return c.json({ error: "token required" }, 400);
    if (!callbackUrl || typeof callbackUrl !== "string") return c.json({ error: "callbackUrl required" }, 400);

    store.set(token, { token, callbackUrl, registeredAt: Date.now() });
    return c.json({ token }, 201);
  });

  app.get("/:token", (c) => {
    const token = c.req.param("token");
    const entry = store.get(token);
    if (!entry) return c.json({ error: "token not found" }, 404);
    return c.json({ token: entry.token, callbackUrl: entry.callbackUrl });
  });

  app.delete("/:token", (c) => {
    const token = c.req.param("token");
    if (!store.has(token)) return c.json({ error: "token not found" }, 404);
    store.delete(token);
    return c.json({ ok: true });
  });

  return app;
}
