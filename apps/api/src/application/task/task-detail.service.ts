import type { TaskService } from "./task.service";
import type { ConnectorConfigRepository } from "../../domain/connector-config/connector-config.repository";
import { ClickUpApiClient } from "../../infrastructure/connectors/clickup-api.client";
import { GitHubApiClient } from "../../infrastructure/connectors/github-api.client";
import { GitLabApiClient } from "../../infrastructure/connectors/gitlab-api.client";

export interface TaskDetailComment {
  author?: string;
  body?: string;
  [key: string]: unknown;
}

export interface TaskDetail {
  description: string | null;
  comments: TaskDetailComment[];
}

export class TaskDetailService {
  constructor(
    private tasks: TaskService,
    private connectorConfigs: ConnectorConfigRepository,
  ) {}

  async getDetail(taskId: string): Promise<TaskDetail | null> {
    const task = await this.tasks.getById(taskId);
    if (!task) return null;

    if (task.source === "clickup" && task.externalId) {
      const cfg = await this.connectorConfigs.findByType("clickup");
      if (cfg) {
        const client = new ClickUpApiClient(cfg.token);
        const [detail, comments] = await Promise.all([
          client.fetchTaskDetail(task.externalId),
          client.fetchTaskComments(task.externalId),
        ]);
        return {
          description: detail.markdownDescription || detail.textContent || null,
          comments,
        };
      }
    }

    if (task.source === "github" && task.externalId) {
      const hashIdx = task.externalId.lastIndexOf("#");
      if (hashIdx > 0) {
        const repo = task.externalId.slice(0, hashIdx);
        const issueNumber = parseInt(task.externalId.slice(hashIdx + 1), 10);
        const cfg = await this.connectorConfigs.findByType("github");
        if (cfg && Number.isFinite(issueNumber)) {
          const settings = cfg.settings as { username?: string };
          const client = new GitHubApiClient(cfg.token, settings.username || "");
          const [detail, comments] = await Promise.all([
            client.fetchIssueDetail(repo, issueNumber),
            client.fetchIssueComments(repo, issueNumber),
          ]);
          return { description: detail.body ?? null, comments };
        }
      }
    }

    if (task.source === "gitlab" && task.externalId) {
      const match = task.externalId.match(/^project:(\d+)#iid:(\d+)$/);
      if (match) {
        const projectId = parseInt(match[1], 10);
        const iid = parseInt(match[2], 10);
        const cfg = await this.connectorConfigs.findByType("gitlab");
        if (cfg) {
          const settings = cfg.settings as { baseUrl?: string };
          const client = new GitLabApiClient(cfg.token, settings.baseUrl || "https://gitlab.com");
          const [detail, comments] = await Promise.all([
            client.fetchIssueDetail(projectId, iid),
            client.fetchIssueNotes(projectId, iid),
          ]);
          return { description: detail.description ?? null, comments };
        }
      }
    }

    return { description: task.description ?? null, comments: [] };
  }
}
