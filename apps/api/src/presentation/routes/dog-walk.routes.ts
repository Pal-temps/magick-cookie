import { Hono } from "hono";
import type { DogWalkService } from "../../application/dog-walk/dog-walk.service";
import { createDogWalkSchema, dogWalkQuerySchema } from "../validators/dog-walk.validator";

export function createDogWalkRoutes(service: DogWalkService) {
  const app = new Hono();

  // Get active walk (if any)
  app.get("/active", async (c) => {
    const walk = await service.getActive();
    return c.json({ data: walk });
  });

  // List all walks
  app.get("/", async (c) => {
    const query = dogWalkQuerySchema.parse(c.req.query());
    const walks = await service.getAll(query.from, query.to);
    return c.json({ data: walks });
  });

  // Today stats
  app.get("/stats/today", async (c) => {
    const stats = await service.getTodayStats();
    return c.json({ data: stats });
  });

  // Daily stats
  app.get("/stats/daily", async (c) => {
    const query = dogWalkQuerySchema.parse(c.req.query());
    if (!query.from || !query.to) {
      return c.json({ error: "from and to are required" }, 400);
    }
    const stats = await service.getDailyStats(query.from, query.to);
    return c.json({ data: stats });
  });

  // Start a walk
  app.post("/start", async (c) => {
    const body = createDogWalkSchema.parse(await c.req.json());
    const walk = await service.start(body);
    return c.json({ data: walk }, 201);
  });

  // Stop a walk
  app.post("/:id/stop", async (c) => {
    const id = c.req.param("id");
    const walk = await service.stop(id);
    return c.json({ data: walk });
  });

  return app;
}
