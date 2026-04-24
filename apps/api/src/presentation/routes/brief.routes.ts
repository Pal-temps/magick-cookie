import { Hono } from "hono";
import { z } from "zod";
import type { BriefService } from "../../application/brief/brief.service";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional();

const briefGetSchema = z.object({ date: dateString });
const briefPostSchema = z.object({
  date: dateString,
  prompt: z.string().min(1).max(4000).optional(),
});

function resolveDate(raw: string | undefined): Date {
  if (!raw) return new Date();
  const d = new Date(raw);
  if (isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

export function createBriefRoutes(briefService: BriefService) {
  const app = new Hono();

  app.get("/generate", async (c) => {
    const parsed = briefGetSchema.safeParse({ date: c.req.query("date") });
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const data = await briefService.generate(resolveDate(parsed.data.date));
    return c.json({ data });
  });

  app.post("/generate", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const queryDate = c.req.query("date");
    const parsed = briefPostSchema.safeParse({ date: body.date ?? queryDate, prompt: body.prompt });
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const data = await briefService.generate(resolveDate(parsed.data.date), parsed.data.prompt);
    return c.json({ data });
  });

  return app;
}
