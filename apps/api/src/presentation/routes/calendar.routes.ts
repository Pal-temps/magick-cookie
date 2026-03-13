import { Hono } from "hono";
import type { CalendarService } from "../../application/calendar/calendar.service";
import { createCalendarSchema, updateCalendarSchema } from "../validators/calendar.validator";

export function createCalendarRoutes(service: CalendarService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const calendars = await service.getAll();
    return c.json({ data: calendars });
  });

  app.get("/:id", async (c) => {
    const calendar = await service.getById(c.req.param("id"));
    if (!calendar) return c.json({ error: "Calendar not found" }, 404);
    return c.json({ data: calendar });
  });

  app.post("/", async (c) => {
    const body = createCalendarSchema.parse(await c.req.json());
    const calendar = await service.create(body);
    return c.json({ data: calendar }, 201);
  });

  app.put("/:id", async (c) => {
    const body = updateCalendarSchema.parse(await c.req.json());
    const calendar = await service.update(c.req.param("id"), body);
    if (!calendar) return c.json({ error: "Calendar not found" }, 404);
    return c.json({ data: calendar });
  });

  app.delete("/:id", async (c) => {
    const deleted = await service.delete(c.req.param("id"));
    if (!deleted) return c.json({ error: "Calendar not found" }, 404);
    return c.json({ data: { success: true } });
  });

  return app;
}
