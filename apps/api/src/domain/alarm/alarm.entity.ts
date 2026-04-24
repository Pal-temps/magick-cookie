export type RepeatPattern = "once" | "daily" | "weekdays" | "weekends" | "custom";

export interface Alarm {
  id: string;
  time: string;
  label: string;
  repeatPattern: RepeatPattern;
  repeatDays: number[] | null;
  enabled: boolean;
  alertSound: string | null;
  lastFiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAlarmInput {
  time: string;
  label: string;
  repeatPattern?: RepeatPattern;
  repeatDays?: number[] | null;
  enabled?: boolean;
  alertSound?: string | null;
}

export interface UpdateAlarmInput {
  time?: string;
  label?: string;
  repeatPattern?: RepeatPattern;
  repeatDays?: number[] | null;
  enabled?: boolean;
  alertSound?: string | null;
}
