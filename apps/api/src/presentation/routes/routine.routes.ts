import { Hono } from "hono";
import type { RoutineService } from "../../application/routine/routine.service";
import { createRoutineSchema, updateRoutineSchema } from "../validators/routine.validator";

export function createRoutineRoutes(service: RoutineService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const routines = await service.getAll();
    return c.json({ data: routines });
  });

  app.get("/:id", async (c) => {
    const routine = await service.getById(c.req.param("id"));
    if (!routine) return c.json({ error: "Routine not found" }, 404);
    return c.json({ data: routine });
  });

  app.post("/", async (c) => {
    const body = createRoutineSchema.parse(await c.req.json());
    const routine = await service.create(body);
    return c.json({ data: routine }, 201);
  });

  app.put("/:id", async (c) => {
    const body = updateRoutineSchema.parse(await c.req.json());
    const routine = await service.update(c.req.param("id"), body);
    if (!routine) return c.json({ error: "Routine not found" }, 404);
    return c.json({ data: routine });
  });

  app.delete("/:id", async (c) => {
    const deleted = await service.delete(c.req.param("id"));
    if (!deleted) return c.json({ error: "Routine not found" }, 404);
    return c.json({ data: { success: true } });
  });

  app.post("/:id/run", async (c) => {
    const routine = await service.getById(c.req.param("id"));
    if (!routine) return c.json({ error: "Routine not found" }, 404);
    await service.markRun(c.req.param("id"));
    return c.json({ data: { success: true } });
  });

  return app;
}
