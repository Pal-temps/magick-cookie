import type { Reminder } from "./reminder.entity";

export interface ReminderWithEvent extends Reminder {
  eventTitle: string;
  eventStartAt: Date;
}

export interface ReminderEmitter {
  subscribe(listener: (reminder: ReminderWithEvent) => void): () => void;
  emit(reminder: ReminderWithEvent): void;
}
