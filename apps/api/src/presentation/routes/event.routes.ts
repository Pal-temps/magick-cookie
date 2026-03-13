import { Hono } from "hono";
import type { EventService } from "../../application/event/event.service";
import { createEventSchema, updateEventSchema, eventQuerySchema } from "../validators/event.validator";

export function createEventRoutes(eventService: EventService) {
  const app = new Hono();

  // GET /api/events?from=&to=&calendarId=
  app.get("/", async (c) => {
    const query = eventQuerySchema.parse(c.req.query());
    const events = await eventService.getAll(query);
    return c.json({ data: events });
  });

  // GET /api/events/:id
  app.get("/:id", async (c) => {
    const event = await eventService.getById(c.req.param("id"));
    if (!event) return c.json({ error: "Event not found" }, 404);
    return c.json({ data: event });
  });

  // PUT /api/events/:id
  app.put("/:id", async (c) => {
    const body = updateEventSchema.parse(await c.req.json());
    const event = await eventService.update(c.req.param("id"), body);
    if (!event) return c.json({ error: "Event not found" }, 404);
    return c.json({ data: event });
  });

  // DELETE /api/events/:id
  app.delete("/:id", async (c) => {
    const deleted = await eventService.delete(c.req.param("id"));
    if (!deleted) return c.json({ error: "Event not found" }, 404);
    return c.json({ data: { success: true } });
  });

  return app;
}

export function createCalendarEventRoutes(eventService: EventService) {
  const app = new Hono();

  // GET /api/calendars/:calendarId/events?from=&to=
  app.get("/", async (c) => {
    const calendarId = c.req.param("calendarId")!;
    const query = eventQuerySchema.parse(c.req.query());
    const events = await eventService.getByCalendarId(calendarId, query);
    return c.json({ data: events });
  });

  // POST /api/calendars/:calendarId/events
  app.post("/", async (c) => {
    const calendarId = c.req.param("calendarId")!;
    const body = createEventSchema.parse(await c.req.json());
    const { reminders, ...eventInput } = body;
    const event = await eventService.create(
      { ...eventInput, calendarId },
      reminders,
    );
    return c.json({ data: event }, 201);
  });

  return app;
}
