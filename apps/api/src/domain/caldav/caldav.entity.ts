export interface CalDavAccount {
  id: string;
  label: string;
  url: string;
  username: string;
  calendarId: string | null;
  lastSyncedAt: Date | null;
  syncEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCalDavAccountInput {
  label: string;
  url: string;
  username: string;
  password: string;
  calendarId?: string;
}

export interface UpdateCalDavAccountInput {
  label?: string;
  url?: string;
  username?: string;
  password?: string;
  calendarId?: string;
  syncEnabled?: boolean;
}

export interface ParsedCalEvent {
  uid: string;
  summary: string;
  dtstart: Date | null;
  dtend: Date | null;
  description: string | null;
  location: string | null;
}
