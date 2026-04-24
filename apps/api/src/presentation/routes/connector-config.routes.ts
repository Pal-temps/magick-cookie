import { Hono } from "hono";
import type { ConnectorConfigService } from "../../application/connector-config/connector-config.service";
import { connectorTypeSchema, upsertConnectorConfigSchema } from "../validators/connector-config.validator";
import type { ConnectorType, ConnectorConfig } from "../../domain/connector-config/connector-config.entity";

function toPublic(cfg: ConnectorConfig) {
  const { token, ...rest } = cfg;
  return {
    ...rest,
    tokenPreview: token.length >= 8 ? token.slice(0, 4) + "..." + token.slice(-4) : "***",
  };
}

export function createConnectorConfigRoutes(service: ConnectorConfigService) {
  const app = new Hono();

  // GET /api/connector-configs — list all (tokens masked)
  app.get("/", async (c) => {
    const configs = await service.getAll();
    return c.json({ data: configs.map(toPublic) });
  });

  // GET /api/connector-configs/:type
  app.get("/:type", async (c) => {
    const parsed = connectorTypeSchema.safeParse(c.req.param("type"));
    if (!parsed.success) return c.json({ error: "Invalid connector type" }, 400);

    const config = await service.getByType(parsed.data);
    if (!config) return c.json({ error: "Not found" }, 404);

    return c.json({ data: toPublic(config) });
  });

  // PUT /api/connector-configs/:type — upsert
  app.put("/:type", async (c) => {
    const typeParsed = connectorTypeSchema.safeParse(c.req.param("type"));
    if (!typeParsed.success) return c.json({ error: "Invalid connector type" }, 400);

    const body = await c.req.json();
    const parsed = upsertConnectorConfigSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const config = await service.save(typeParsed.data as ConnectorType, parsed.data.token, parsed.data.settings);
    return c.json({ data: toPublic(config) });
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
