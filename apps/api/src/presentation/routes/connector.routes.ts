import { Hono } from "hono";
import type { ClickUpSyncService } from "../../application/connector/clickup-sync.service";
import type { ClickUpConnectorRepository } from "../../domain/connector/clickup.repository";

export function createConnectorRoutes(syncService: ClickUpSyncService, connectorRepo: ClickUpConnectorRepository) {
  const app = new Hono();

  // POST /api/connectors/clickup/sync
  app.post("/clickup/sync", async (c) => {
    const result = await syncService.sync();
    return c.json({ data: result });
  });

  // GET /api/connectors/clickup/tasks — unscheduled tasks
  app.get("/clickup/tasks", async (c) => {
    const tasks = await connectorRepo.findUnscheduledTasks();
    return c.json({ data: tasks });
  });

  return app;
}
