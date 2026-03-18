import type { EmailAccountRepository, EmailRepository } from "../../domain/email/email.repository";
import type { EmailAccount, Email, CreateEmailAccountInput, UpdateEmailAccountInput } from "../../domain/email/email.entity";
import type { ImapConnector } from "../../infrastructure/connectors/imap.connector";
import type { EmailRuleService } from "./email-rule.service";

export interface EmailDigestBySender {
  sender: string;
  count: number;
  subjects: string[];
}

export interface EmailDigest {
  totalUnread: number;
  period: { from: string; to: string };
  bySender: EmailDigestBySender[];
}

export class EmailService {
  private emailRuleService?: EmailRuleService;

  constructor(
    private accountRepo: EmailAccountRepository,
    private emailRepo: EmailRepository,
    private imapConnector: ImapConnector,
  ) {}

  setEmailRuleService(service: EmailRuleService) {
    this.emailRuleService = service;
  }

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

  async updateSummary(id: string, summary: string, classification?: string): Promise<Email | null> {
    return this.emailRepo.updateSummary(id, summary, classification);
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

    // Apply email rules to newly imported emails
    if (this.emailRuleService && newEmails > 0) {
      await this.applyRulesToRecent(accountId, newEmails);
    }

    await this.accountRepo.updateLastSyncedAt(accountId, new Date());

    return { newEmails };
  }

  private async applyRulesToRecent(accountId: string, count: number): Promise<void> {
    if (!this.emailRuleService) return;
    try {
      const recentEmails = await this.emailRepo.findByAccount(accountId, { limit: count });
      for (const email of recentEmails) {
        const result = await this.emailRuleService.applyRules(email);
        const flags: { isStarred?: boolean; isArchived?: boolean } = {};
        if (result.isStarred !== undefined) flags.isStarred = result.isStarred;
        if (result.isArchived !== undefined) flags.isArchived = result.isArchived;

        if (Object.keys(flags).length > 0) {
          await this.emailRepo.updateFlags(email.id, flags);
        }
        if (result.classification) {
          await this.emailRepo.updateSummary(email.id, email.summary || "", result.classification);
        }
      }
    } catch (err) {
      console.error("[email-rules] Failed to apply rules:", err);
    }
  }

  // --- Digest ---

  async getDigest(days: number = 7): Promise<EmailDigest> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get unread emails from the last N days
    const emails = await this.emailRepo.findAll({ unread: true, limit: 200 });
    const recent = emails.filter((e) => new Date(e.sentAt) >= since);

    // Group by sender
    const bySender = new Map<string, { count: number; subjects: string[] }>();
    for (const email of recent) {
      const sender = email.fromName || email.fromAddress;
      const entry = bySender.get(sender) || { count: 0, subjects: [] };
      entry.count++;
      if (entry.subjects.length < 3) entry.subjects.push(email.subject || "(sans sujet)");
      bySender.set(sender, entry);
    }

    return {
      totalUnread: recent.length,
      period: { from: since.toISOString(), to: new Date().toISOString() },
      bySender: Array.from(bySender.entries())
        .map(([sender, data]) => ({
          sender,
          count: data.count,
          subjects: data.subjects,
        }))
        .sort((a, b) => b.count - a.count),
    };
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
