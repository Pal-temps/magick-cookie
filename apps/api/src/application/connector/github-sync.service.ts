import { GitHubApiClient } from "../../infrastructure/connectors/github-api.client";
import type { ConnectorConfigRepository } from "../../domain/connector-config/connector-config.repository";
import type { CalendarService } from "../calendar/calendar.service";
import type { EventRepository } from "../../domain/event/event.repository";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { Calendar } from "../../domain/calendar/calendar.entity";

const GITHUB_CALENDAR_NAME = "GitHub";
const GITHUB_CALENDAR_COLOR = "#24292e";

export class GitHubSyncService {
  constructor(
    private connectorConfigRepo: ConnectorConfigRepository,
    private calendarService: CalendarService,
    private eventRepo: EventRepository,
    private taskRepo: TaskRepository,
  ) {}

  async sync(): Promise<{ eventsCreated: number; eventsUpdated: number; tasksUpserted: number }> {
    const config = await this.connectorConfigRepo.findByType("github");
    if (!config || !config.enabled) {
      throw new Error("GitHub connector not configured or disabled");
    }

    const settings = config.settings as {
      username?: string;
      repos?: string[];
      syncIssues?: boolean;
      syncPRs?: boolean;
    };

    const username = settings.username || "";
    const repos = settings.repos || [];
    if (repos.length === 0) {
      return { eventsCreated: 0, eventsUpdated: 0, tasksUpserted: 0 };
    }

    const client = new GitHubApiClient(config.token, username);

    const allIssues = [];
    if (settings.syncIssues !== false) {
      const issues = await client.fetchIssues(repos);
      allIssues.push(...issues);
    }
    if (settings.syncPRs) {
      const prs = await client.fetchPRsAsIssues(repos);
      allIssues.push(...prs);
    }

    const calendar = await this.ensureCalendar();
    const allExternalIds: string[] = [];
    let eventsCreated = 0;
    let eventsUpdated = 0;

    for (const issue of allIssues) {
      const externalId = `${issue.repo}#${issue.number}`;
      allExternalIds.push(externalId);

      const localTask = await this.taskRepo.upsertByExternalId({
        externalId,
        source: "github",
        title: `${issue.isPR ? "[PR] " : ""}${issue.title}`,
        description: issue.body,
        status: issue.state,
        priority: null,
        url: issue.url,
        labels: issue.labels,
        assignees: issue.assignees,
        dueDate: issue.dueDate,
        metadata: { repo: issue.repo, issueNumber: issue.number, isPR: issue.isPR, milestone: issue.milestone },
      });

      if (issue.dueDate) {
        const existing = await this.eventRepo.findByTaskId(localTask.id);
        const description = `[${issue.state}] ${issue.repo}#${issue.number}\n${issue.url}`;
        const endAt = issue.dueDate;
        const startAt = new Date(endAt.getTime() - 60 * 60 * 1000);

        if (existing) {
          await this.eventRepo.update(existing.id, { title: issue.title, description, startAt, endAt });
          eventsUpdated++;
        } else {
          await this.eventRepo.create({
            calendarId: calendar.id,
            title: issue.title,
            description,
            startAt,
            endAt,
            isAllDay: false,
            taskId: localTask.id,
          });
          eventsCreated++;
        }
      }
    }

    await this.taskRepo.deleteNotInExternalIds("github", allExternalIds);

    return { eventsCreated, eventsUpdated, tasksUpserted: allIssues.length };
  }

  private async ensureCalendar(): Promise<Calendar> {
    const calendars = await this.calendarService.getAll();
    const existing = calendars.find((c) => c.name === GITHUB_CALENDAR_NAME);
    if (existing) return existing;
    return this.calendarService.create({ name: GITHUB_CALENDAR_NAME, color: GITHUB_CALENDAR_COLOR, isDefault: false });
  }
}
