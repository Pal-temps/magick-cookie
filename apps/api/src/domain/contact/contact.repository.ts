import type { Contact, CreateContactInput, UpdateContactInput } from "./contact.entity";

export interface ContactRepository {
  findAll(): Promise<Contact[]>;
  findById(id: string): Promise<Contact | null>;
  create(input: CreateContactInput): Promise<Contact>;
  update(id: string, input: UpdateContactInput): Promise<Contact | null>;
  delete(id: string): Promise<boolean>;
}
