import { Hono } from "hono";
import type { UserPreferencesService } from "../../application/user-preferences/user-preferences.service";
import { userPreferencesSchema } from "../validators/user-preferences.validator";

export function createUserPreferencesRoutes(service: UserPreferencesService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const data = await service.get();
    return c.json({ data });
  });

  app.put("/", async (c) => {
    const body = userPreferencesSchema.parse(await c.req.json());
    const saved = await service.save(body);
    return c.json({ data: saved });
  });

  return app;
}
