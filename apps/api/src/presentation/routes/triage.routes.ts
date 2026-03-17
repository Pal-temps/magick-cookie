import { Hono } from "hono";
import type { TriageService } from "../../application/triage/triage.service";
import type { TriageStatus } from "../../domain/triage/triage.entity";

const VALID_STATUSES: TriageStatus[] = ["priority", "later", "archived", "dismissed"];

export function createTriageRoutes(triageService: TriageService) {
  const app = new Hono();

  // GET /api/triage — all triage decisions
  app.get("/", async (c) => {
    const status = c.req.query("status") as TriageStatus | undefined;
    const data = status && VALID_STATUSES.includes(status)
      ? await triageService.getByStatus(status)
      : await triageService.getAll();
    return c.json({ data });
  });

  // POST /api/triage — set single triage
  app.post("/", async (c) => {
    const body = await c.req.json<{ taskId: string; triageStatus: TriageStatus }>();
    if (!body.taskId || !VALID_STATUSES.includes(body.triageStatus)) {
      return c.json({ error: "Invalid input" }, 400);
    }
    const data = await triageService.setTriage(body);
    return c.json({ data });
  });

  // POST /api/triage/bulk — bulk save triage decisions
  app.post("/bulk", async (c) => {
    const body = await c.req.json<{ items: { taskId: string; triageStatus: TriageStatus }[] }>();
    if (!Array.isArray(body.items)) {
      return c.json({ error: "Invalid input" }, 400);
    }
    const valid = body.items.filter(
      (item) => item.taskId && VALID_STATUSES.includes(item.triageStatus)
    );
    await triageService.bulkSetTriage(valid);
    return c.json({ data: { saved: valid.length } });
  });

  // POST /api/triage/suggest — LLM auto-triage suggestions
  app.post("/suggest", async (c) => {
    const suggestions = await triageService.suggestTriage();
    return c.json({ data: suggestions });
  });

  // DELETE /api/triage/:taskId — reset single task triage
  app.delete("/:taskId", async (c) => {
    const taskId = c.req.param("taskId");
    await triageService.resetTriage(taskId);
    return c.json({ data: { ok: true } });
  });

  // DELETE /api/triage — reset all triage
  app.delete("/", async (c) => {
    await triageService.resetAll();
    return c.json({ data: { ok: true } });
  });

  return app;
}
