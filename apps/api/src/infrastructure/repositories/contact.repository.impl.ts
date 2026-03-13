import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { contacts } from "../database/schema";
import type { ContactRepository } from "../../domain/contact/contact.repository";
import type { Contact, CreateContactInput, UpdateContactInput } from "../../domain/contact/contact.entity";

export class DrizzleContactRepository implements ContactRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<Contact[]> {
    const rows = await this.db.select().from(contacts).orderBy(contacts.createdAt);
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<Contact | null> {
    const rows = await this.db.select().from(contacts).where(eq(contacts.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateContactInput): Promise<Contact> {
    const rows = await this.db.insert(contacts).values({
      name: input.name,
      birthDate: input.birthDate ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateContactInput): Promise<Contact | null> {
    const values: Record<string, unknown> = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.birthDate !== undefined) values.birthDate = input.birthDate;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.email !== undefined) values.email = input.email;
    if (input.notes !== undefined) values.notes = input.notes;

    const rows = await this.db.update(contacts).set(values).where(eq(contacts.id, id)).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(contacts).where(eq(contacts.id, id)).returning({ id: contacts.id });
    return rows.length > 0;
  }

  private toDomain(row: typeof contacts.$inferSelect): Contact {
    return {
      id: row.id,
      name: row.name,
      birthDate: row.birthDate,
      phone: row.phone,
      email: row.email,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
