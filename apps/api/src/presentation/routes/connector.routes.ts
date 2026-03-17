import { Hono } from "hono";
import type { ClickUpSyncService } from "../../application/connector/clickup-sync.service";

export function createConnectorRoutes(syncService: ClickUpSyncService) {
  const app = new Hono();

  // POST /api/connectors/clickup/sync
  app.post("/clickup/sync", async (c) => {
    const result = await syncService.sync();
    return c.json({ data: result });
  });

  return app;
}
