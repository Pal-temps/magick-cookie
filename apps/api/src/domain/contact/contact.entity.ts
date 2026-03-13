export interface Contact {
  id: string;
  name: string;
  birthDate: Date | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContactInput {
  name: string;
  birthDate?: Date | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface UpdateContactInput {
  name?: string;
  birthDate?: Date | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}
