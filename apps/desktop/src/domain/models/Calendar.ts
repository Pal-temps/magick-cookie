export interface Calendar {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalendarDTO {
  name: string;
  description?: string | null;
  color?: string;
  isDefault?: boolean;
}

export interface UpdateCalendarDTO {
  name?: string;
  description?: string | null;
  color?: string;
  isDefault?: boolean;
}
