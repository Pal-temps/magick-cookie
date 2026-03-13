export type ReminderType = "push";

export interface Reminder {
  id: string;
  eventId: string;
  type: ReminderType;
  minutesBefore: number;
  scheduledAt: Date;
  sentAt: Date | null;
  createdAt: Date;
}

export interface CreateReminderInput {
  eventId: string;
  type?: ReminderType;
  minutesBefore?: number;
  scheduledAt: Date;
}
