import type { ReminderRepository } from "../../domain/reminder/reminder.repository";
import type { EventRepository } from "../../domain/event/event.repository";
import type { Reminder } from "../../domain/reminder/reminder.entity";

export class ReminderService {
  constructor(
    private reminderRepo: ReminderRepository,
    private eventRepo: EventRepository,
  ) {}

  async getByEventId(eventId: string): Promise<Reminder[]> {
    return this.reminderRepo.findByEventId(eventId);
  }

  async getPending(): Promise<Reminder[]> {
    return this.reminderRepo.findPending();
  }

  async create(eventId: string, minutesBefore: number = 15): Promise<Reminder> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new Error("Event not found");

    const scheduledAt = new Date(event.startAt.getTime() - minutesBefore * 60_000);
    return this.reminderRepo.create({
      eventId,
      minutesBefore,
      scheduledAt,
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.reminderRepo.delete(id);
  }

  async markAsSent(id: string): Promise<void> {
    return this.reminderRepo.markAsSent(id);
  }
}
