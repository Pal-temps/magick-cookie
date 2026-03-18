import { Hono } from "hono";
import type { WebhookService } from "../../application/webhook/webhook.service";
import { createWebhookSchema, updateWebhookSchema } from "../validators/webhook.validator";

export function createWebhookRoutes(service: WebhookService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const webhooks = await service.getAll();
    return c.json({ data: webhooks });
  });

  app.get("/:id", async (c) => {
    const webhook = await service.getById(c.req.param("id"));
    if (!webhook) return c.json({ error: "Webhook not found" }, 404);
    return c.json({ data: webhook });
  });

  app.post("/", async (c) => {
    const body = createWebhookSchema.parse(await c.req.json());
    const webhook = await service.create(body);
    return c.json({ data: webhook }, 201);
  });

  app.put("/:id", async (c) => {
    const body = updateWebhookSchema.parse(await c.req.json());
    const webhook = await service.update(c.req.param("id"), body);
    if (!webhook) return c.json({ error: "Webhook not found" }, 404);
    return c.json({ data: webhook });
  });

  app.delete("/:id", async (c) => {
    const deleted = await service.delete(c.req.param("id"));
    if (!deleted) return c.json({ error: "Webhook not found" }, 404);
    return c.json({ data: { success: true } });
  });

  // Public endpoint — validates secret via query param
  app.post("/:id/receive", async (c) => {
    const secret = c.req.query("secret");
    if (!secret) return c.json({ error: "Missing secret" }, 401);

    const payload = await c.req.json();
    const event = await service.receiveEvent(c.req.param("id"), secret, payload);
    if (!event) return c.json({ error: "Webhook not found or invalid secret" }, 404);
    return c.json({ data: event }, 201);
  });

  // List events for a webhook
  app.get("/:id/events", async (c) => {
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : undefined;
    const events = await service.getEvents(c.req.param("id"), limit);
    return c.json({ data: events });
  });

  // Mark event as read
  app.post("/events/:eventId/read", async (c) => {
    const event = await service.markEventRead(c.req.param("eventId"));
    if (!event) return c.json({ error: "Event not found" }, 404);
    return c.json({ data: event });
  });

  return app;
}
