import { Hono } from "hono";
import type { FluxService } from "../../application/flux/flux.service";
import type { FluxEntityType, FluxStatus } from "../../domain/flux/flux.entity";

const VALID_STATUSES = ["priority", "later", "archived", "dismissed"];
const VALID_TYPES = ["task", "email", "rss_article"];

export function createFluxRoutes(fluxService: FluxService) {
  const app = new Hono();

  // GET /api/flux?status=priority&type=task
  app.get("/", async (c) => {
    const status = c.req.query("status") as FluxStatus | undefined;
    const entityType = c.req.query("type") as FluxEntityType | undefined;

    if (entityType && !VALID_TYPES.includes(entityType)) {
      return c.json({ error: `Invalid type. Valid: ${VALID_TYPES.join(", ")}` }, 400);
    }

    let data;
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return c.json({ error: `Invalid status. Valid: ${VALID_STATUSES.join(", ")}` }, 400);
      }
      data = await fluxService.getByStatus(status, entityType);
    } else {
      data = await fluxService.getAll(entityType);
    }
    return c.json({ data });
  });

  // POST /api/flux — set single flux decision
  app.post("/", async (c) => {
    const { entityType, entityId, fluxStatus } = await c.req.json<{
      entityType: string;
      entityId: string;
      fluxStatus: string;
    }>();

    if (!entityType || !entityId || !fluxStatus) {
      return c.json({ error: "entityType, entityId, and fluxStatus are required" }, 400);
    }
    if (!VALID_TYPES.includes(entityType)) {
      return c.json({ error: `Invalid entityType. Valid: ${VALID_TYPES.join(", ")}` }, 400);
    }
    if (!VALID_STATUSES.includes(fluxStatus)) {
      return c.json({ error: `Invalid fluxStatus. Valid: ${VALID_STATUSES.join(", ")}` }, 400);
    }

    const data = await fluxService.setFlux({
      entityType: entityType as FluxEntityType,
      entityId,
      fluxStatus: fluxStatus as FluxStatus,
    });
    return c.json({ data });
  });

  // POST /api/flux/bulk — batch set
  app.post("/bulk", async (c) => {
    const { items } = await c.req.json<{
      items: { entityType: string; entityId: string; fluxStatus: string }[];
    }>();

    if (!items || !Array.isArray(items)) {
      return c.json({ error: "items array required" }, 400);
    }

    const validated = items.filter(
      (i) => i.entityType && i.entityId && i.fluxStatus
        && VALID_TYPES.includes(i.entityType)
        && VALID_STATUSES.includes(i.fluxStatus)
    ).map((i) => ({
      entityType: i.entityType as FluxEntityType,
      entityId: i.entityId,
      fluxStatus: i.fluxStatus as FluxStatus,
    }));

    await fluxService.bulkSetFlux(validated);
    return c.json({ data: { count: validated.length } });
  });

  // POST /api/flux/suggest — AI suggestions
  app.post("/suggest", async (c) => {
    const body = await c.req.json<{ entityType?: string }>().catch(() => ({}));
    const entityType = body.entityType as FluxEntityType | undefined;
    if (entityType && !VALID_TYPES.includes(entityType)) {
      return c.json({ error: `Invalid entityType` }, 400);
    }
    const data = await fluxService.suggestFlux(entityType);
    return c.json({ data });
  });

  // DELETE /api/flux/:entityType/:entityId — reset single
  app.delete("/:entityType/:entityId", async (c) => {
    const entityType = c.req.param("entityType") as FluxEntityType;
    const entityId = c.req.param("entityId");
    if (!VALID_TYPES.includes(entityType)) {
      return c.json({ error: `Invalid entityType` }, 400);
    }
    await fluxService.resetFlux(entityType, entityId);
    return c.json({ data: { ok: true } });
  });

  // DELETE /api/flux — reset all
  app.delete("/", async (c) => {
    await fluxService.resetAll();
    return c.json({ data: { ok: true } });
  });

  return app;
}
