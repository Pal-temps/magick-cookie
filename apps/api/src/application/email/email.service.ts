import type { EmailAccountRepository, EmailRepository } from "../../domain/email/email.repository";
import type { EmailAccount, Email, CreateEmailAccountInput, UpdateEmailAccountInput } from "../../domain/email/email.entity";
import type { ImapConnector } from "../../infrastructure/connectors/imap.connector";

export class EmailService {
  constructor(
    private accountRepo: EmailAccountRepository,
    private emailRepo: EmailRepository,
    private imapConnector: ImapConnector,
  ) {}

  // --- Accounts ---

  async getAccounts(): Promise<EmailAccount[]> {
    return this.accountRepo.findAll();
  }

  async getActiveAccounts(): Promise<EmailAccount[]> {
    return this.accountRepo.findActive();
  }

  async getAccountById(id: string): Promise<EmailAccount | null> {
    return this.accountRepo.findById(id);
  }

  async createAccount(input: CreateEmailAccountInput): Promise<EmailAccount> {
    return this.accountRepo.create(input);
  }

  async updateAccount(id: string, input: UpdateEmailAccountInput): Promise<EmailAccount | null> {
    return this.accountRepo.update(id, input);
  }

  async deleteAccount(id: string): Promise<boolean> {
    return this.accountRepo.delete(id);
  }

  async testConnection(input: CreateEmailAccountInput): Promise<boolean> {
    return this.imapConnector.testConnection({
      host: input.imapHost,
      port: input.imapPort,
      secure: input.imapSecure,
      username: input.username,
      password: input.password,
    });
  }

  // --- Emails ---

  async getEmails(options?: { accountId?: string; folder?: string; unread?: boolean; limit?: number; offset?: number }): Promise<Email[]> {
    if (options?.accountId) {
      return this.emailRepo.findByAccount(options.accountId, options);
    }
    return this.emailRepo.findAll(options);
  }

  async getEmailById(id: string): Promise<Email | null> {
    return this.emailRepo.findById(id);
  }

  async updateEmailFlags(id: string, flags: { isRead?: boolean; isStarred?: boolean; isArchived?: boolean }): Promise<Email | null> {
    return this.emailRepo.updateFlags(id, flags);
  }

  async deleteEmail(id: string): Promise<boolean> {
    return this.emailRepo.delete(id);
  }

  async getUnreadCount(accountId?: string): Promise<number> {
    return this.emailRepo.countUnread(accountId);
  }

  // --- Sync ---

  async syncAccount(accountId: string): Promise<{ newEmails: number }> {
    const account = await this.accountRepo.findById(accountId);
    if (!account) throw new Error("Account not found");

    const password = await this.accountRepo.getPassword(accountId);
    if (!password) throw new Error("Account password not found");

    const maxUid = await this.emailRepo.findMaxUid(accountId, "INBOX");
    const rawEmails = await this.imapConnector.fetchNewEmails(account, password, "INBOX", maxUid ?? undefined);
    const newEmails = await this.emailRepo.bulkCreate(rawEmails);

    await this.accountRepo.updateLastSyncedAt(accountId, new Date());

    return { newEmails };
  }

  async syncAll(): Promise<{ total: number; errors: string[] }> {
    const accounts = await this.accountRepo.findActive();
    let total = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        const result = await this.syncAccount(account.id);
        total += result.newEmails;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${account.label}: ${msg}`);
        console.error(`[email-sync] Failed to sync ${account.label}:`, err);
      }
    }

    return { total, errors };
  }
}
