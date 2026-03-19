import { Hono } from "hono";
import type { TaskService } from "../../application/task/task.service";
import { ClickUpApiClient } from "../../infrastructure/connectors/clickup-api.client";
import { GitHubApiClient } from "../../infrastructure/connectors/github-api.client";
import { GitLabApiClient } from "../../infrastructure/connectors/gitlab-api.client";
import type { ConnectorConfigRepository } from "../../domain/connector-config/connector-config.repository";
import type { TaskSource } from "../../domain/task/task.entity";

export function createTaskRoutes(
  taskService: TaskService,
  connectorConfigRepo: ConnectorConfigRepository,
) {
  const app = new Hono();

  // GET /api/tasks — optional ?source=clickup filter
  app.get("/", async (c) => {
    const source = c.req.query("source") as TaskSource | undefined;
    const data = source
      ? await taskService.getBySource(source)
      : await taskService.getAll();
    return c.json({ data });
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
      const cfg = await connectorConfigRepo.findByType("clickup");
      if (cfg) {
        const client = new ClickUpApiClient(cfg.token);
        const [detail, comments] = await Promise.all([
          client.fetchTaskDetail(task.externalId),
          client.fetchTaskComments(task.externalId),
        ]);
        return c.json({
          data: {
            description: detail.markdownDescription || detail.textContent,
            comments,
          },
        });
      }
    }

    if (task.source === "github" && task.externalId) {
      // externalId format: "owner/repo#123"
      const hashIdx = task.externalId.lastIndexOf("#");
      const repo = task.externalId.slice(0, hashIdx);
      const issueNumber = parseInt(task.externalId.slice(hashIdx + 1), 10);

      const cfg = await connectorConfigRepo.findByType("github");
      if (cfg) {
        const settings = cfg.settings as { username?: string };
        const client = new GitHubApiClient(cfg.token, settings.username || "");
        const [detail, comments] = await Promise.all([
          client.fetchIssueDetail(repo, issueNumber),
          client.fetchIssueComments(repo, issueNumber),
        ]);
        return c.json({ data: { description: detail.body, comments } });
      }
    }

    if (task.source === "gitlab" && task.externalId) {
      // externalId format: "project:123#iid:456"
      const match = task.externalId.match(/^project:(\d+)#iid:(\d+)$/);
      if (match) {
        const projectId = parseInt(match[1], 10);
        const iid = parseInt(match[2], 10);

        const cfg = await connectorConfigRepo.findByType("gitlab");
        if (cfg) {
          const settings = cfg.settings as { baseUrl?: string };
          const client = new GitLabApiClient(cfg.token, settings.baseUrl || "https://gitlab.com");
          const [detail, comments] = await Promise.all([
            client.fetchIssueDetail(projectId, iid),
            client.fetchIssueNotes(projectId, iid),
          ]);
          return c.json({ data: { description: detail.description, comments } });
        }
      }
    }

    // For manual tasks or missing config, return what we have
    return c.json({
      data: {
        description: task.description,
        comments: [],
      },
    });
  });

  return app;
}
