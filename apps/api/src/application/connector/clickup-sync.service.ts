import type { ClickUpApiClient } from "../../infrastructure/connectors/clickup-api.client";
import type { CalendarService } from "../calendar/calendar.service";
import type { EventRepository } from "../../domain/event/event.repository";
import type { ClickUpConnectorRepository } from "../../domain/connector/clickup.repository";
import type { ClickUpTask } from "../../domain/connector/clickup.entity";
import type { Calendar } from "../../domain/calendar/calendar.entity";

const CLICKUP_CALENDAR_NAME = "ClickUp";
const CLICKUP_CALENDAR_COLOR = "#7B68EE";

export class ClickUpSyncService {
  constructor(
    private clickUpClient: ClickUpApiClient,
    private calendarService: CalendarService,
    private eventRepo: EventRepository,
    private connectorRepo: ClickUpConnectorRepository,
  ) {}

  async sync(): Promise<{ eventsCreated: number; eventsUpdated: number; unscheduledCount: number }> {
    // 1. Fetch all tasks from ClickUp
    const allTasks = await this.clickUpClient.fetchAllTasks();

    // 2. Ensure ClickUp calendar exists
    const calendar = await this.ensureClickUpCalendar();

    // 3. Split tasks
    const withDueDate = allTasks.filter((t) => t.dueDate !== null);
    const withoutDueDate = allTasks.filter((t) => t.dueDate === null);

    // 4. Sync tasks with due dates as events
    let eventsCreated = 0;
    let eventsUpdated = 0;

    for (const task of withDueDate) {
      const existing = await this.eventRepo.findByClickUpTaskId(task.id);
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
          clickupTaskId: task.id,
        });
        eventsCreated++;
      }
    }

    // 5. Upsert unscheduled tasks
    for (const task of withoutDueDate) {
      await this.connectorRepo.upsertUnscheduledTask({
        clickupTaskId: task.id,
        name: task.name,
        description: task.description,
        status: task.status,
        url: task.url,
        listName: task.listName,
        priority: task.priority,
        assignees: task.assignees,
      });
    }

    // 6. Clean up stale unscheduled tasks
    const currentUnscheduledIds = withoutDueDate.map((t) => t.id);
    await this.connectorRepo.deleteUnscheduledTasksNotIn(currentUnscheduledIds);

    return {
      eventsCreated,
      eventsUpdated,
      unscheduledCount: withoutDueDate.length,
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

  private buildEventDescription(task: ClickUpTask): string {
    return `[${task.status}] ${task.listName}\n${task.url}\n\n${task.description || ""}`;
  }

  private computeEventTimes(task: ClickUpTask): { startAt: Date; endAt: Date } {
    const endAt = task.dueDate!;

    if (task.startDate) {
      return { startAt: task.startDate, endAt };
    }

    // No start_date: make it a 1-hour event ending at due_date
    const startAt = new Date(endAt.getTime() - 60 * 60 * 1000);
    return { startAt, endAt };
  }
}
