import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { PushNotificationRepository } from "../../domain/push/push-notification.repository";
import { uuidSchema } from "../validators/shared.validator";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export function createPushRoutes(pushRepo: PushNotificationRepository) {
  const app = new Hono();

  // GET / — all notifications (recent, with limit)
  app.get("/", async (c) => {
    const parsed = listQuerySchema.safeParse({ limit: c.req.query("limit") });
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const data = await pushRepo.findAll(parsed.data.limit);
    return c.json({ data });
  });

  // GET /pending — unread notifications
  app.get("/pending", async (c) => {
    const data = await pushRepo.findPending();
    return c.json({ data });
  });

  // POST /:id/read — mark as read
  app.post("/:id/read", async (c) => {
    const id = uuidSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "Invalid id" }, 400);
    await pushRepo.markAsRead(id.data);
    return c.json({ success: true });
  });

  // POST /read-all — mark all as read
  app.post("/read-all", async (c) => {
    await pushRepo.markAllAsRead();
    return c.json({ success: true });
  });

  // GET /stream — SSE stream for real-time push
  app.get("/stream", async (c) => {
    return streamSSE(c, async (stream) => {
      let lastCheck = new Date();

      while (true) {
        try {
          const pending = await pushRepo.findPending();
          const newNotifs = pending.filter((n) => n.createdAt > lastCheck);

          for (const notif of newNotifs) {
            await stream.writeSSE({
              event: "push",
              data: JSON.stringify(notif),
              id: notif.id,
            });
          }

          if (newNotifs.length > 0) {
            lastCheck = new Date();
          }
        } catch {
          // Ignore errors, keep streaming
        }

        // Heartbeat
        await stream.writeSSE({ event: "heartbeat", data: "" });
        await stream.sleep(15_000);
      }
    });
  });

  return app;
}
