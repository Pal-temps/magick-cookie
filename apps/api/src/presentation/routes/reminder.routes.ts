import { Hono } from "hono";
import type { ReminderService } from "../../application/reminder/reminder.service";
import { createReminderSchema } from "../validators/reminder.validator";

export function createReminderRoutes(reminderService: ReminderService) {
  const app = new Hono();

  // GET /api/reminders/pending
  app.get("/pending", async (c) => {
    const reminders = await reminderService.getPending();
    return c.json({ data: reminders });
  });

  // POST /api/reminders/:id/ack — client confirms it displayed the notification
  app.post("/:id/ack", async (c) => {
    const id = c.req.param("id");
    await reminderService.markAsSent(id);
    return c.json({ data: { success: true } });
  });

  // DELETE /api/reminders/:id
  app.delete("/:id", async (c) => {
    const deleted = await reminderService.delete(c.req.param("id"));
    if (!deleted) return c.json({ error: "Reminder not found" }, 404);
    return c.json({ data: { success: true } });
  });

  return app;
}

export function createEventReminderRoutes(reminderService: ReminderService) {
  const app = new Hono();

  // GET /api/events/:eventId/reminders
  app.get("/", async (c) => {
    const eventId = c.req.param("eventId")!;
    const reminders = await reminderService.getByEventId(eventId);
    return c.json({ data: reminders });
  });

  // POST /api/events/:eventId/reminders
  app.post("/", async (c) => {
    const eventId = c.req.param("eventId")!;
    const body = createReminderSchema.parse(await c.req.json());
    const reminder = await reminderService.create(eventId, body.minutesBefore);
    return c.json({ data: reminder }, 201);
  });

  return app;
}
