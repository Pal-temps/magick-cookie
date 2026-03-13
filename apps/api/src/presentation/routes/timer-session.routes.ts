import { Hono } from "hono";
import type { TimerSessionService } from "../../application/timer-session/timer-session.service";
import { createTimerSessionSchema, timerSessionQuerySchema } from "../validators/timer-session.validator";

export function createTimerSessionRoutes(service: TimerSessionService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const query = timerSessionQuerySchema.parse(c.req.query());
    const sessions = await service.getAll(query.from, query.to);
    return c.json({ data: sessions });
  });

  app.get("/stats/today", async (c) => {
    const stats = await service.getTodayStats();
    return c.json({ data: stats });
  });

  app.post("/", async (c) => {
    const body = createTimerSessionSchema.parse(await c.req.json());
    const session = await service.create(body);
    return c.json({ data: session }, 201);
  });

  return app;
}
