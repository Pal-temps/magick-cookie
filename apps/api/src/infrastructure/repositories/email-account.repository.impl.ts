import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { emailAccounts } from "../database/schema";
import type { EmailAccountRepository } from "../../domain/email/email.repository";
import type { EmailAccount, CreateEmailAccountInput, UpdateEmailAccountInput } from "../../domain/email/email.entity";

export class DrizzleEmailAccountRepository implements EmailAccountRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<EmailAccount[]> {
    const rows = await this.db.select().from(emailAccounts).orderBy(emailAccounts.createdAt);
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<EmailAccount | null> {
    const rows = await this.db.select().from(emailAccounts).where(eq(emailAccounts.id, id)).limit(1);
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async findActive(): Promise<EmailAccount[]> {
    const rows = await this.db.select().from(emailAccounts)
      .where(eq(emailAccounts.syncEnabled, true))
      .orderBy(emailAccounts.createdAt);
    return rows.map(this.toDomain);
  }

  async create(input: CreateEmailAccountInput): Promise<EmailAccount> {
    const rows = await this.db.insert(emailAccounts).values({
      label: input.label,
      email: input.email,
      imapHost: input.imapHost,
      imapPort: input.imapPort,
      imapSecure: input.imapSecure,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpSecure: input.smtpSecure,
      username: input.username,
      passwordEnc: input.password, // Phase 1: stocké en clair
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateEmailAccountInput): Promise<EmailAccount | null> {
    const rows = await this.db.update(emailAccounts)
      .set(input)
      .where(eq(emailAccounts.id, id))
      .returning();
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async updateLastSyncedAt(id: string, date: Date): Promise<void> {
    await this.db.update(emailAccounts)
      .set({ lastSyncedAt: date })
      .where(eq(emailAccounts.id, id));
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(emailAccounts).where(eq(emailAccounts.id, id)).returning();
    return rows.length > 0;
  }

  async getPassword(id: string): Promise<string | null> {
    const rows = await this.db.select({ passwordEnc: emailAccounts.passwordEnc })
      .from(emailAccounts)
      .where(eq(emailAccounts.id, id))
      .limit(1);
    return rows.length > 0 ? rows[0].passwordEnc : null;
  }

  private toDomain(row: typeof emailAccounts.$inferSelect): EmailAccount {
    return {
      id: row.id,
      label: row.label,
      email: row.email,
      imapHost: row.imapHost,
      imapPort: row.imapPort,
      imapSecure: row.imapSecure,
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      smtpSecure: row.smtpSecure,
      username: row.username,
      lastSyncedAt: row.lastSyncedAt,
      syncEnabled: row.syncEnabled,
      createdAt: row.createdAt!,
      updatedAt: row.updatedAt!,
    };
  }
}
