export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  isAllDay: boolean;
  recurrenceRule: string | null;
  clickupTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEventInput {
  calendarId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: Date;
  endAt: Date;
  isAllDay?: boolean;
  recurrenceRule?: string | null;
  clickupTaskId?: string | null;
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  location?: string | null;
  startAt?: Date;
  endAt?: Date;
  isAllDay?: boolean;
  recurrenceRule?: string | null;
}

export interface EventQueryFilters {
  from?: Date;
  to?: Date;
  calendarId?: string;
}
