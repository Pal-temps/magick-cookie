import { Hono } from "hono";
import type { WellnessConfigService } from "../../application/wellness-config/wellness-config.service";
import { createWellnessConfigSchema, updateWellnessConfigSchema } from "../validators/wellness-config.validator";

export function createWellnessConfigRoutes(service: WellnessConfigService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const configs = await service.getAll();
    return c.json({ data: configs });
  });

  app.post("/", async (c) => {
    const body = createWellnessConfigSchema.parse(await c.req.json());
    const config = await service.create(body);
    return c.json({ data: config }, 201);
  });

  app.put("/:id", async (c) => {
    const body = updateWellnessConfigSchema.parse(await c.req.json());
    const config = await service.update(c.req.param("id"), body);
    if (!config) return c.json({ error: "Wellness config not found" }, 404);
    return c.json({ data: config });
  });

  app.delete("/:id", async (c) => {
    const deleted = await service.delete(c.req.param("id"));
    if (!deleted) return c.json({ error: "Wellness config not found" }, 404);
    return c.json({ data: { success: true } });
  });

  return app;
}
