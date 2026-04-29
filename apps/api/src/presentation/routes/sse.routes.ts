import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ReminderEmitter } from "../../domain/reminder/reminder-emitter";

export function createSSERoutes(emitter: ReminderEmitter) {
  const app = new Hono();

  app.get("/", (c) => {
    return streamSSE(c, async (stream) => {
      const unsubscribe = emitter.subscribe(async (reminder) => {
        try {
          await stream.writeSSE({
            event: "reminder",
            data: JSON.stringify(reminder),
            id: reminder.id,
          });
        } catch {
          // Stream closed, will be cleaned up
        }
      });

      // Keep the connection alive with heartbeats
      const heartbeat = setInterval(async () => {
        try {
          await stream.writeSSE({ event: "heartbeat", data: "" });
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15_000);

      // Cleanup when client disconnects
      stream.onAbort(() => {
        unsubscribe();
        clearInterval(heartbeat);
      });

      // Hold the stream open
      await new Promise(() => {});
    });
  });

  return app;
}
