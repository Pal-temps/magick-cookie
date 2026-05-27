import { Hono } from "hono";
import type { ChangelogService } from "../../application/changelog/changelog.service";

export function createChangelogRoutes(changelogService: ChangelogService) {
  const app = new Hono();

  // POST /api/changelog/generate — body: { since: string (ISO date), repo?: string }
  app.post("/generate", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!body.since) {
      return c.json({ error: "Missing 'since' date" }, 400);
    }
    const since = new Date(body.since);
    if (isNaN(since.getTime())) {
      return c.json({ error: "Invalid 'since' date" }, 400);
    }
    try {
      const data = await changelogService.generate(since, body.repo);
      return c.json({ data });
    } catch (err) {
      if (err instanceof Error && err.message === "No LLM configured") {
        return c.json({ error: "LLM not configured" }, 503);
      }
      throw err;
    }
  });

  return app;
}
