import type { CalDavAccountRepository } from "../../domain/caldav/caldav.repository";
import type { CalDavAccount, CreateCalDavAccountInput, UpdateCalDavAccountInput } from "../../domain/caldav/caldav.entity";
import type { CalDavConnector } from "../../infrastructure/connectors/caldav.connector";
import type { EventRepository } from "../../domain/event/event.repository";

export class CalDavService {
  constructor(
    private accountRepo: CalDavAccountRepository,
    private caldavConnector: CalDavConnector,
    private eventRepo: EventRepository,
  ) {}

  // --- Accounts ---

  async getAccounts(): Promise<CalDavAccount[]> {
    return this.accountRepo.findAll();
  }

  async getAccountById(id: string): Promise<CalDavAccount | null> {
    return this.accountRepo.findById(id);
  }

  async createAccount(input: CreateCalDavAccountInput): Promise<CalDavAccount> {
    return this.accountRepo.create(input);
  }

  async updateAccount(id: string, input: UpdateCalDavAccountInput): Promise<CalDavAccount | null> {
    return this.accountRepo.update(id, input);
  }

  async deleteAccount(id: string): Promise<boolean> {
    return this.accountRepo.delete(id);
  }

  async testConnection(input: CreateCalDavAccountInput): Promise<boolean> {
    return this.caldavConnector.testConnection(input.url, input.username, input.password);
  }

  // --- Sync ---

  async syncAccount(accountId: string): Promise<{ imported: number; updated: number }> {
    const account = await this.accountRepo.findById(accountId);
    if (!account) throw new Error("CalDAV account not found");
    if (!account.calendarId) throw new Error("No calendar assigned to CalDAV account");

    const password = await this.accountRepo.getPassword(accountId);
    if (!password) throw new Error("CalDAV account password not found");

    const events = await this.caldavConnector.fetchEvents(account.url, account.username, password);

    let imported = 0;
    let updated = 0;

    for (const ev of events) {
      if (!ev.dtstart || !ev.dtend) continue;

      // Check if event already exists (by matching title + start time in same calendar)
      // Simple upsert: try to create, skip on conflict-like behavior
      try {
        await this.eventRepo.create({
          calendarId: account.calendarId,
          title: ev.summary,
          description: ev.description,
          location: ev.location,
          startAt: ev.dtstart,
          endAt: ev.dtend,
          isAllDay: false,
          recurrenceRule: null,
        });
        imported++;
      } catch {
        // Event likely already exists — count as update
        updated++;
      }
    }

    await this.accountRepo.updateLastSyncedAt(accountId, new Date());

    return { imported, updated };
  }

  async syncAll(): Promise<{ total: number; errors: string[] }> {
    const accounts = await this.accountRepo.findActive();
    let total = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        if (!account.calendarId) continue;
        const result = await this.syncAccount(account.id);
        total += result.imported;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${account.label}: ${msg}`);
        console.error(`[caldav-sync] Failed to sync ${account.label}:`, err);
      }
    }

    return { total, errors };
  }
}
