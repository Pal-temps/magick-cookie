export interface Calendar {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCalendarInput {
  name: string;
  description?: string | null;
  color?: string;
  isDefault?: boolean;
}

export interface UpdateCalendarInput {
  name?: string;
  description?: string | null;
  color?: string;
  isDefault?: boolean;
}
