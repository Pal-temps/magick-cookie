import { Hono } from "hono";
import type { BriefService } from "../../application/brief/brief.service";

export function createBriefRoutes(briefService: BriefService) {
  const app = new Hono();

  // GET /api/brief/generate?date=YYYY-MM-DD
  app.get("/generate", async (c) => {
    const dateStr = c.req.query("date");
    const date = dateStr ? new Date(dateStr) : new Date();
    const data = await briefService.generate(date);
    return c.json({ data });
  });

  // POST /api/brief/generate — accepts { date?, prompt? }
  app.post("/generate", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const dateStr = body.date || c.req.query("date");
    const date = dateStr ? new Date(dateStr) : new Date();
    const data = await briefService.generate(date, body.prompt);
    return c.json({ data });
  });

  return app;
}
