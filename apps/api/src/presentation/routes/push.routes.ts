import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { PushNotificationRepository } from "../../domain/push/push-notification.repository";

export function createPushRoutes(pushRepo: PushNotificationRepository) {
  const app = new Hono();

  // GET / — all notifications (recent, with limit)
  app.get("/", async (c) => {
    const limit = parseInt(c.req.query("limit") ?? "50", 10);
    const data = await pushRepo.findAll(limit);
    return c.json({ data });
  });

  // GET /pending — unread notifications
  app.get("/pending", async (c) => {
    const data = await pushRepo.findPending();
    return c.json({ data });
  });

  // POST /:id/read — mark as read
  app.post("/:id/read", async (c) => {
    await pushRepo.markAsRead(c.req.param("id"));
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
