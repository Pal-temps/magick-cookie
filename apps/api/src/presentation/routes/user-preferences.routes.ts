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
    const parsed = userPreferencesSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: "Invalid preferences", issues: parsed.error.issues }, 400);
    }
    const saved = await service.save(parsed.data);
    return c.json({ data: saved });
  });

  return app;
}
