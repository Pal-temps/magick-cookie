import { Hono } from "hono";
import type { TaskService } from "../../application/task/task.service";
import type { ClickUpApiClient } from "../../infrastructure/connectors/clickup-api.client";
import type { TaskSource } from "../../domain/task/task.entity";

export function createTaskRoutes(taskService: TaskService, clickUpApiClient: ClickUpApiClient) {
  const app = new Hono();

  // GET /api/tasks — optional ?source=clickup filter
  app.get("/", async (c) => {
    const source = c.req.query("source") as TaskSource | undefined;
    const data = source
      ? await taskService.getBySource(source)
      : await taskService.getAll();
    return c.json({ data });
  });

  // GET /api/tasks/unscheduled — tasks with no due date
  app.get("/unscheduled", async (c) => {
    const data = await taskService.getUnscheduled();
    return c.json({ data });
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

  // GET /api/tasks/:id/detail — fetch detail from external source
  app.get("/:id/detail", async (c) => {
    const id = c.req.param("id");
    const task = await taskService.getById(id);
    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    if (task.source === "clickup" && task.externalId) {
      const [detail, comments] = await Promise.all([
        clickUpApiClient.fetchTaskDetail(task.externalId),
        clickUpApiClient.fetchTaskComments(task.externalId),
      ]);
      return c.json({
        data: {
          description: detail.markdownDescription || detail.textContent,
          comments,
        },
      });
    }

    // For non-external tasks, return what we have
    return c.json({
      data: {
        description: task.description,
        comments: [],
      },
    });
  });

  return app;
}
