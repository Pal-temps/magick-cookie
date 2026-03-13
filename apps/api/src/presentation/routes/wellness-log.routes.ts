import { Hono } from "hono";
import type { WellnessLogService } from "../../application/wellness-log/wellness-log.service";
import { wellnessLogDateSchema, wellnessLogRangeSchema, incrementWellnessLogSchema, setGoalSchema } from "../validators/wellness-log.validator";

export function createWellnessLogRoutes(service: WellnessLogService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const query = wellnessLogDateSchema.parse(c.req.query());
    const logs = await service.getByDate(query.date);
    return c.json({ data: logs });
  });

  app.get("/range", async (c) => {
    const query = wellnessLogRangeSchema.parse(c.req.query());
    const logs = await service.getByRange(query.from, query.to, query.type);
    return c.json({ data: logs });
  });

  app.post("/increment", async (c) => {
    const body = incrementWellnessLogSchema.parse(await c.req.json());
    const log = await service.increment(body.date, body.type, body.amount);
    return c.json({ data: log });
  });

  app.post("/goal", async (c) => {
    const body = setGoalSchema.parse(await c.req.json());
    const log = await service.setGoal(body.date, body.type, body.goal);
    return c.json({ data: log });
  });

  return app;
}
