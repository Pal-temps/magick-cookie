import type { EventRepository } from "../../domain/event/event.repository";
import type { ReminderRepository } from "../../domain/reminder/reminder.repository";
import type { CalendarEvent, CreateEventInput, UpdateEventInput, EventQueryFilters } from "../../domain/event/event.entity";
import type { CreateReminderInput } from "../../domain/reminder/reminder.entity";

export class EventService {
  constructor(
    private eventRepo: EventRepository,
    private reminderRepo: ReminderRepository,
  ) {}

  async getAll(filters: EventQueryFilters): Promise<CalendarEvent[]> {
    return this.eventRepo.findAll(filters);
  }

  async getByCalendarId(calendarId: string, filters: Omit<EventQueryFilters, "calendarId">): Promise<CalendarEvent[]> {
    return this.eventRepo.findByCalendarId(calendarId, filters);
  }

  async getById(id: string): Promise<CalendarEvent | null> {
    return this.eventRepo.findById(id);
  }

  async create(input: CreateEventInput, reminders?: { minutesBefore: number }[]): Promise<CalendarEvent> {
    const event = await this.eventRepo.create(input);

    if (reminders?.length) {
      for (const r of reminders) {
        const scheduledAt = new Date(event.startAt.getTime() - r.minutesBefore * 60_000);
        await this.reminderRepo.create({
          eventId: event.id,
          minutesBefore: r.minutesBefore,
          scheduledAt,
        });
      }
    }

    return event;
  }

  async update(id: string, input: UpdateEventInput): Promise<CalendarEvent | null> {
    const event = await this.eventRepo.update(id, input);

    if (event && input.startAt) {
      await this.reminderRepo.updateScheduledAt(event.id, event.startAt);
    }

    return event;
  }

  async delete(id: string): Promise<boolean> {
    return this.eventRepo.delete(id);
  }
}
