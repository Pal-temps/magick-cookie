import { Hono } from "hono";
import type { ProjectService } from "../../application/project/project.service";
import { createProjectSchema, updateProjectSchema } from "../validators/project.validator";

export function createProjectRoutes(service: ProjectService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const projects = await service.getAll();
    return c.json({ data: projects });
  });

  app.post("/", async (c) => {
    const body = createProjectSchema.parse(await c.req.json());
    const project = await service.create(body);
    return c.json({ data: project }, 201);
  });

  app.put("/:id", async (c) => {
    const body = updateProjectSchema.parse(await c.req.json());
    const project = await service.update(c.req.param("id"), body);
    if (!project) return c.json({ error: "Project not found" }, 404);
    return c.json({ data: project });
  });

  app.delete("/:id", async (c) => {
    const deleted = await service.delete(c.req.param("id"));
    if (!deleted) return c.json({ error: "Project not found" }, 404);
    return c.json({ data: { success: true } });
  });

  return app;
}
