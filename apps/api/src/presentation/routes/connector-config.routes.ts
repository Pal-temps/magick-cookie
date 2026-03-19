import { Hono } from "hono";
import type { ConnectorConfigService } from "../../application/connector-config/connector-config.service";
import { connectorTypeSchema, upsertConnectorConfigSchema } from "../validators/connector-config.validator";
import type { ConnectorType } from "../../domain/connector-config/connector-config.entity";

export function createConnectorConfigRoutes(service: ConnectorConfigService) {
  const app = new Hono();

  // GET /api/connector-configs — list all (tokens masked)
  app.get("/", async (c) => {
    const configs = await service.getAll();
    const masked = configs.map((cfg) => ({
      ...cfg,
      token: cfg.token.slice(0, 4) + "..." + cfg.token.slice(-4),
    }));
    return c.json({ data: masked });
  });

  // GET /api/connector-configs/:type
  app.get("/:type", async (c) => {
    const parsed = connectorTypeSchema.safeParse(c.req.param("type"));
    if (!parsed.success) return c.json({ error: "Invalid connector type" }, 400);

    const config = await service.getByType(parsed.data);
    if (!config) return c.json({ error: "Not found" }, 404);

    return c.json({
      data: {
        ...config,
        token: config.token.slice(0, 4) + "..." + config.token.slice(-4),
      },
    });
  });

  // PUT /api/connector-configs/:type — upsert
  app.put("/:type", async (c) => {
    const typeParsed = connectorTypeSchema.safeParse(c.req.param("type"));
    if (!typeParsed.success) return c.json({ error: "Invalid connector type" }, 400);

    const body = await c.req.json();
    const parsed = upsertConnectorConfigSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const config = await service.save(typeParsed.data as ConnectorType, parsed.data.token, parsed.data.settings);
    return c.json({
      data: {
        ...config,
        token: config.token.slice(0, 4) + "..." + config.token.slice(-4),
      },
    });
  });

  // DELETE /api/connector-configs/:type
  app.delete("/:type", async (c) => {
    const parsed = connectorTypeSchema.safeParse(c.req.param("type"));
    if (!parsed.success) return c.json({ error: "Invalid connector type" }, 400);

    await service.delete(parsed.data as ConnectorType);
    return c.json({ data: { ok: true } });
  });

  return app;
}
