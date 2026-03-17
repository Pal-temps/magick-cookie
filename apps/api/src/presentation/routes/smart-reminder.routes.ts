import { Hono } from "hono";
import type { SmartReminderService } from "../../application/smart-reminder/smart-reminder.service";

export function createSmartReminderRoutes(service: SmartReminderService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const alerts = await service.getAlerts();
    return c.json({ data: { alerts } });
  });

  return app;
}
