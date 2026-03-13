import type { Reminder, CreateReminderInput } from "./reminder.entity";

export interface ReminderRepository {
  findByEventId(eventId: string): Promise<Reminder[]>;
  findPending(): Promise<Reminder[]>;
  create(input: CreateReminderInput): Promise<Reminder>;
  delete(id: string): Promise<boolean>;
  deleteByEventId(eventId: string): Promise<void>;
  markAsSent(id: string): Promise<void>;
  updateScheduledAt(eventId: string, newStartAt: Date): Promise<void>;
}
