import { Hono } from "hono";
import type { AlarmService } from "../../application/alarm/alarm.service";
import { createAlarmSchema, updateAlarmSchema } from "../validators/alarm.validator";

export function createAlarmRoutes(service: AlarmService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const alarms = await service.getAll();
    return c.json({ data: alarms });
  });

  app.post("/", async (c) => {
    const body = createAlarmSchema.parse(await c.req.json());
    const alarm = await service.create(body);
    return c.json({ data: alarm }, 201);
  });

  app.put("/:id", async (c) => {
    const body = updateAlarmSchema.parse(await c.req.json());
    const alarm = await service.update(c.req.param("id"), body);
    if (!alarm) return c.json({ error: "Alarm not found" }, 404);
    return c.json({ data: alarm });
  });

  app.delete("/:id", async (c) => {
    const deleted = await service.delete(c.req.param("id"));
    if (!deleted) return c.json({ error: "Alarm not found" }, 404);
    return c.json({ data: { success: true } });
  });

  app.post("/:id/fire", async (c) => {
    const alarm = await service.getById(c.req.param("id"));
    if (!alarm) return c.json({ error: "Alarm not found" }, 404);
    await service.markFired(c.req.param("id"));
    return c.json({ data: { success: true } });
  });

  return app;
}
