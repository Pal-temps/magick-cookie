import type { ClickUpApiClient } from "../../infrastructure/connectors/clickup-api.client";
import type { CalendarService } from "../calendar/calendar.service";
import type { EventRepository } from "../../domain/event/event.repository";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { Calendar } from "../../domain/calendar/calendar.entity";

const CLICKUP_CALENDAR_NAME = "ClickUp";
const CLICKUP_CALENDAR_COLOR = "#7B68EE";

export class ClickUpSyncService {
  constructor(
    private clickUpClient: ClickUpApiClient,
    private calendarService: CalendarService,
    private eventRepo: EventRepository,
    private taskRepo: TaskRepository,
  ) {}

  async sync(): Promise<{ eventsCreated: number; eventsUpdated: number; tasksUpserted: number }> {
    // 1. Fetch all tasks from ClickUp
    const allTasks = await this.clickUpClient.fetchAllTasks();

    // 2. Ensure ClickUp calendar exists
    const calendar = await this.ensureClickUpCalendar();

    // 3. Upsert ALL tasks into the tasks table
    const allExternalIds: string[] = [];
    let eventsCreated = 0;
    let eventsUpdated = 0;

    for (const task of allTasks) {
      allExternalIds.push(task.id);

      // Upsert the task
      const localTask = await this.taskRepo.upsertByExternalId({
        externalId: task.id,
        source: "clickup",
        title: task.name,
        description: task.description,
        status: task.status,
        priority: task.priority,
        url: task.url,
        labels: [task.listName],
        assignees: task.assignees,
        dueDate: task.dueDate,
        startDate: task.startDate,
        metadata: { spaceName: task.spaceName, listName: task.listName },
      });

      // 4. Sync tasks with due dates as events
      if (task.dueDate) {
        const existing = await this.eventRepo.findByTaskId(localTask.id);
        const description = this.buildEventDescription(task);
        const { startAt, endAt } = this.computeEventTimes(task);

        if (existing) {
          await this.eventRepo.update(existing.id, {
            title: task.name,
            description,
            location: task.url,
            startAt,
            endAt,
          });
          eventsUpdated++;
        } else {
          await this.eventRepo.create({
            calendarId: calendar.id,
            title: task.name,
            description,
            location: task.url,
            startAt,
            endAt,
            isAllDay: false,
            taskId: localTask.id,
          });
          eventsCreated++;
        }
      }
    }

    // 5. Clean up stale tasks from ClickUp source
    await this.taskRepo.deleteNotInExternalIds("clickup", allExternalIds);

    return {
      eventsCreated,
      eventsUpdated,
      tasksUpserted: allTasks.length,
    };
  }

  private async ensureClickUpCalendar(): Promise<Calendar> {
    const calendars = await this.calendarService.getAll();
    const existing = calendars.find((c) => c.name === CLICKUP_CALENDAR_NAME);

    if (existing) return existing;

    return this.calendarService.create({
      name: CLICKUP_CALENDAR_NAME,
      color: CLICKUP_CALENDAR_COLOR,
      isDefault: false,
    });
  }

  private buildEventDescription(task: { status: string; listName: string; url: string; description: string | null }): string {
    return `[${task.status}] ${task.listName}\n${task.url}\n\n${task.description || ""}`;
  }

  private computeEventTimes(task: { dueDate: Date | null; startDate: Date | null }): { startAt: Date; endAt: Date } {
    const endAt = task.dueDate!;

    if (task.startDate) {
      return { startAt: task.startDate, endAt };
    }

    // No start_date: make it a 1-hour event ending at due_date
    const startAt = new Date(endAt.getTime() - 60 * 60 * 1000);
    return { startAt, endAt };
  }
}
