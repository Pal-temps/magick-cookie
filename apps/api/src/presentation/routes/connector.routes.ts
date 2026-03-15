import { Hono } from "hono";
import type { ClickUpSyncService } from "../../application/connector/clickup-sync.service";
import type { ClickUpConnectorRepository } from "../../domain/connector/clickup.repository";
import type { ClickUpApiClient } from "../../infrastructure/connectors/clickup-api.client";

export function createConnectorRoutes(syncService: ClickUpSyncService, connectorRepo: ClickUpConnectorRepository, clickUpClient: ClickUpApiClient) {
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

  // GET /api/connectors/clickup/tasks/:taskId/detail — full task detail + comments
  app.get("/clickup/tasks/:taskId/detail", async (c) => {
    const taskId = c.req.param("taskId");
    const [detail, comments] = await Promise.all([
      clickUpClient.fetchTaskDetail(taskId),
      clickUpClient.fetchTaskComments(taskId),
    ]);
    return c.json({
      data: {
        description: detail.markdownDescription || detail.textContent,
        comments,
      },
    });
  });

  return app;
}
