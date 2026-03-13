import type { ContactRepository } from "../../domain/contact/contact.repository";
import type { Contact, CreateContactInput, UpdateContactInput } from "../../domain/contact/contact.entity";

export class ContactService {
  constructor(private contactRepo: ContactRepository) {}

  async getAll(): Promise<Contact[]> {
    return this.contactRepo.findAll();
  }

  async getById(id: string): Promise<Contact | null> {
    return this.contactRepo.findById(id);
  }

  async create(input: CreateContactInput): Promise<Contact> {
    return this.contactRepo.create(input);
  }

  async update(id: string, input: UpdateContactInput): Promise<Contact | null> {
    return this.contactRepo.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.contactRepo.delete(id);
  }
}
