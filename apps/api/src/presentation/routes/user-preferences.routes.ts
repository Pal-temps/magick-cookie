import { Hono } from "hono";
import type { UserPreferencesService } from "../../application/user-preferences/user-preferences.service";
import type { ToolRegistry } from "../../application/agent/tool-registry";
import { userPreferencesSchema } from "../validators/user-preferences.validator";

export function createUserPreferencesRoutes(
  service: UserPreferencesService,
  toolRegistry?: ToolRegistry,
) {
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
    // Sync disabled tools to the in-memory registry immediately
    if (toolRegistry && parsed.data.aiTools?.disabledTools) {
      toolRegistry.setDisabledTools(parsed.data.aiTools.disabledTools);
    } else if (toolRegistry && parsed.data.aiTools) {
      toolRegistry.setDisabledTools([]);
    }
    return c.json({ data: saved });
  });

  return app;
}
