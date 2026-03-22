export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  recurrenceRule: string | null;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
  _isBirthday?: boolean;
  _isAlarm?: boolean;
}

export interface CreateEventDTO {
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  isAllDay?: boolean;
  recurrenceRule?: string | null;
  reminders?: { minutesBefore: number }[];
}

export interface UpdateEventDTO {
  title?: string;
  description?: string | null;
  location?: string | null;
  startAt?: string;
  endAt?: string;
  isAllDay?: boolean;
  recurrenceRule?: string | null;
}

export interface Contact {
  id: string;
  name: string;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactDTO {
  name: string;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface UpdateContactDTO {
  name?: string;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}
