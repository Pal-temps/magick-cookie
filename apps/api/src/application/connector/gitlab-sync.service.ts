import { GitLabApiClient } from "../../infrastructure/connectors/gitlab-api.client";
import type { ConnectorConfigRepository } from "../../domain/connector-config/connector-config.repository";
import type { CalendarService } from "../calendar/calendar.service";
import type { EventRepository } from "../../domain/event/event.repository";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { Calendar } from "../../domain/calendar/calendar.entity";

const GITLAB_CALENDAR_NAME = "GitLab";
const GITLAB_CALENDAR_COLOR = "#fc6d26";

export class GitLabSyncService {
  constructor(
    private connectorConfigRepo: ConnectorConfigRepository,
    private calendarService: CalendarService,
    private eventRepo: EventRepository,
    private taskRepo: TaskRepository,
  ) {}

  async sync(): Promise<{ eventsCreated: number; eventsUpdated: number; tasksUpserted: number }> {
    const config = await this.connectorConfigRepo.findByType("gitlab");
    if (!config || !config.enabled) {
      throw new Error("GitLab connector not configured or disabled");
    }

    const settings = config.settings as {
      baseUrl?: string;
      projectIds?: number[];
    };

    const projectIds = settings.projectIds || [];
    if (projectIds.length === 0) {
      return { eventsCreated: 0, eventsUpdated: 0, tasksUpserted: 0 };
    }

    const client = new GitLabApiClient(config.token, settings.baseUrl || "https://gitlab.com");
    const allIssues = await client.fetchIssues(projectIds);

    const calendar = await this.ensureCalendar();
    const allExternalIds: string[] = [];
    let eventsCreated = 0;
    let eventsUpdated = 0;

    for (const issue of allIssues) {
      const externalId = `project:${issue.projectId}#iid:${issue.iid}`;
      allExternalIds.push(externalId);

      const localTask = await this.taskRepo.upsertByExternalId({
        externalId,
        source: "gitlab",
        title: issue.title,
        description: issue.description,
        status: issue.boardColumn || issue.state,
        priority: null,
        url: issue.webUrl,
        labels: issue.labels,
        assignees: issue.assignees,
        dueDate: issue.dueDate,
        metadata: { projectId: issue.projectId, iid: issue.iid, boardColumn: issue.boardColumn, projectName: issue.projectName },
      });

      if (issue.dueDate) {
        const existing = await this.eventRepo.findByTaskId(localTask.id);
        const description = `[${issue.state}] ${issue.projectName}#${issue.iid}\n${issue.webUrl}`;
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

    await this.taskRepo.deleteNotInExternalIds("gitlab", allExternalIds);

    return { eventsCreated, eventsUpdated, tasksUpserted: allIssues.length };
  }

  private async ensureCalendar(): Promise<Calendar> {
    const calendars = await this.calendarService.getAll();
    const existing = calendars.find((c) => c.name === GITLAB_CALENDAR_NAME);
    if (existing) return existing;
    return this.calendarService.create({ name: GITLAB_CALENDAR_NAME, color: GITLAB_CALENDAR_COLOR, isDefault: false });
  }
}
