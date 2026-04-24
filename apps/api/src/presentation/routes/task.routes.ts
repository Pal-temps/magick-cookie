import { Hono } from "hono";
import type { TaskService } from "../../application/task/task.service";
import type { TaskDetailService } from "../../application/task/task-detail.service";
import { taskQuerySchema, taskUpdateSchema } from "../validators/task.validator";

export function createTaskRoutes(
  taskService: TaskService,
  taskDetailService: TaskDetailService,
) {
  const app = new Hono();

  // GET /api/tasks — paginated, optional ?source=clickup filter
  app.get("/", async (c) => {
    const parsed = taskQuerySchema.safeParse({
      source: c.req.query("source"),
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
    });
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { source, limit, offset } = parsed.data;
    const [data, total] = await Promise.all([
      taskService.getAll({ source, limit, offset }),
      taskService.count(source),
    ]);
    return c.json({ data, total });
  });

  // POST /api/tasks — create manual task
  app.post("/", async (c) => {
    const body = await c.req.json();
    const data = await taskService.create({
      source: "manual",
      title: body.title,
      description: body.description ?? null,
      status: body.status ?? "open",
      priority: body.priority ?? null,
      labels: body.labels ?? [],
      assignees: body.assignees ?? [],
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      startDate: body.startDate ? new Date(body.startDate) : null,
    });
    return c.json({ data }, 201);
  });

  // GET /api/tasks/unscheduled — paginated tasks with no due date
  app.get("/unscheduled", async (c) => {
    const parsed = taskQuerySchema.safeParse({
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
    });
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { limit, offset } = parsed.data;
    const [data, total] = await Promise.all([
      taskService.getUnscheduled({ limit, offset }),
      taskService.countUnscheduled(),
    ]);
    return c.json({ data, total });
  });

  // GET /api/tasks/:id — single task
  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    const data = await taskService.getById(id);
    if (!data) {
      return c.json({ error: "Task not found" }, 404);
    }
    return c.json({ data });
  });

  // PATCH /api/tasks/:id — update task fields
  app.patch("/:id", async (c) => {
    const parsed = taskUpdateSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: "Invalid task update", issues: parsed.error.issues }, 400);
    }
    const { title, description, status, priority, startDate, dueDate } = parsed.data;
    const input: Parameters<typeof taskService.update>[1] = {};
    if (title !== undefined) input.title = title;
    if (description !== undefined) input.description = description;
    if (status !== undefined) input.status = status;
    if (priority !== undefined) input.priority = priority;
    if (startDate !== undefined) input.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) input.dueDate = dueDate ? new Date(dueDate) : null;

    const data = await taskService.update(c.req.param("id"), input);
    if (!data) return c.json({ error: "Task not found" }, 404);
    return c.json({ data });
  });

  // GET /api/tasks/:id/detail — fetch detail from external source
  app.get("/:id/detail", async (c) => {
    const detail = await taskDetailService.getDetail(c.req.param("id"));
    if (!detail) return c.json({ error: "Task not found" }, 404);
    return c.json({ data: detail });
  });

  return app;
}
