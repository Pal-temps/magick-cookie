import { Hono } from "hono";
import type { ClickUpSyncService } from "../../application/connector/clickup-sync.service";
import type { GitHubSyncService } from "../../application/connector/github-sync.service";
import type { GitLabSyncService } from "../../application/connector/gitlab-sync.service";

interface SyncServices {
  clickup?: ClickUpSyncService;
  github?: GitHubSyncService;
  gitlab?: GitLabSyncService;
}

export function createConnectorRoutes(syncServices: SyncServices) {
  const app = new Hono();

  // POST /api/connectors/:source/sync
  app.post("/:source/sync", async (c) => {
    const source = c.req.param("source") as keyof SyncServices;
    const service = syncServices[source];
    if (!service) {
      return c.json({ error: `Unknown connector: ${source}` }, 400);
    }
    const result = await service.sync();
    return c.json({ data: result });
  });

  return app;
}
