import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { caldavAccounts } from "../database/schema";
import type { CalDavAccountRepository } from "../../domain/caldav/caldav.repository";
import type { CalDavAccount, CreateCalDavAccountInput, UpdateCalDavAccountInput } from "../../domain/caldav/caldav.entity";

export class DrizzleCalDavAccountRepository implements CalDavAccountRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<CalDavAccount[]> {
    const rows = await this.db.select().from(caldavAccounts).orderBy(caldavAccounts.createdAt);
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<CalDavAccount | null> {
    const rows = await this.db.select().from(caldavAccounts).where(eq(caldavAccounts.id, id)).limit(1);
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async findActive(): Promise<CalDavAccount[]> {
    const rows = await this.db.select().from(caldavAccounts)
      .where(eq(caldavAccounts.syncEnabled, true))
      .orderBy(caldavAccounts.createdAt);
    return rows.map(this.toDomain);
  }

  async create(input: CreateCalDavAccountInput): Promise<CalDavAccount> {
    const rows = await this.db.insert(caldavAccounts).values({
      label: input.label,
      url: input.url,
      username: input.username,
      passwordEnc: input.password,
      calendarId: input.calendarId ?? null,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateCalDavAccountInput): Promise<CalDavAccount | null> {
    const updates: Record<string, unknown> = {};
    if (input.label !== undefined) updates.label = input.label;
    if (input.url !== undefined) updates.url = input.url;
    if (input.username !== undefined) updates.username = input.username;
    if (input.password !== undefined) updates.passwordEnc = input.password;
    if (input.calendarId !== undefined) updates.calendarId = input.calendarId;
    if (input.syncEnabled !== undefined) updates.syncEnabled = input.syncEnabled;

    const rows = await this.db.update(caldavAccounts)
      .set(updates)
      .where(eq(caldavAccounts.id, id))
      .returning();
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async updateLastSyncedAt(id: string, date: Date): Promise<void> {
    await this.db.update(caldavAccounts)
      .set({ lastSyncedAt: date })
      .where(eq(caldavAccounts.id, id));
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(caldavAccounts).where(eq(caldavAccounts.id, id)).returning();
    return rows.length > 0;
  }

  async getPassword(id: string): Promise<string | null> {
    const rows = await this.db.select({ passwordEnc: caldavAccounts.passwordEnc })
      .from(caldavAccounts)
      .where(eq(caldavAccounts.id, id))
      .limit(1);
    return rows.length > 0 ? rows[0].passwordEnc : null;
  }

  private toDomain(row: typeof caldavAccounts.$inferSelect): CalDavAccount {
    return {
      id: row.id,
      label: row.label,
      url: row.url,
      username: row.username,
      calendarId: row.calendarId,
      lastSyncedAt: row.lastSyncedAt,
      syncEnabled: row.syncEnabled,
      createdAt: row.createdAt!,
      updatedAt: row.updatedAt!,
    };
  }
}
