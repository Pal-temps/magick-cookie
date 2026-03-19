import type { EmailAccountRepository, EmailRepository } from "../../domain/email/email.repository";
import type { EmailAccount, Email, CreateEmailAccountInput, UpdateEmailAccountInput, SendEmailInput } from "../../domain/email/email.entity";
import type { ImapConnector } from "../../infrastructure/connectors/imap.connector";
import type { SmtpConnector } from "../../infrastructure/connectors/smtp.connector";
import type { EmailRuleService } from "./email-rule.service";
import type { LlmService } from "../llm/llm.service";

export interface EmailDigestBySender {
  sender: string;
  senderAddress: string;
  count: number;
  subjects: string[];
  emailIds: string[];
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
    private smtpConnector: SmtpConnector,
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

  async testConnection(input: CreateEmailAccountInput): Promise<{ imap: boolean; smtp: boolean }> {
    const [imap, smtp] = await Promise.all([
      this.imapConnector.testConnection({
        host: input.imapHost,
        port: input.imapPort,
        secure: input.imapSecure,
        username: input.username,
        password: input.password,
        selfSigned: input.selfSigned,
      }),
      this.smtpConnector.testConnection({
        host: input.smtpHost,
        port: input.smtpPort,
        secure: input.smtpSecure,
        username: input.username,
        password: input.password,
        selfSigned: input.selfSigned,
      }),
    ]);
    return { imap, smtp };
  }

  async sendEmail(accountId: string, input: SendEmailInput): Promise<Email | null> {
    const account = await this.accountRepo.findById(accountId);
    if (!account) throw new Error("Account not found");

    const password = await this.accountRepo.getPassword(accountId);
    if (!password) throw new Error("Account password not found");

    const { messageId } = await this.smtpConnector.sendEmail(account, password, input);

    // Save a copy in DB as "Sent"
    const saved = await this.emailRepo.create({
      accountId,
      messageId,
      imapUid: null,
      subject: input.subject,
      fromAddress: account.email,
      fromName: account.label,
      toAddresses: input.to.map((addr) => ({ name: null, address: addr })),
      ccAddresses: input.cc?.map((addr) => ({ name: null, address: addr })) ?? [],
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml ?? null,
      hasAttachments: false,
      attachmentNames: [],
      isRead: true,
      folder: "Sent",
      sentAt: new Date(),
    });

    return saved;
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
    const updated = await this.emailRepo.updateFlags(id, flags);
    if (!updated) return null;

    // Sync read status back to IMAP
    if (flags.isRead !== undefined && updated.imapUid) {
      this.syncFlagToImap(updated.accountId, updated.imapUid, updated.folder, "seen", flags.isRead);
    }

    // Sync starred status back to IMAP
    if (flags.isStarred !== undefined && updated.imapUid) {
      this.syncFlagToImap(updated.accountId, updated.imapUid, updated.folder, "flagged", flags.isStarred);
    }

    return updated;
  }

  async deleteEmail(id: string): Promise<boolean> {
    const email = await this.emailRepo.findById(id);
    if (!email) return false;

    // Delete from IMAP first
    if (email.imapUid) {
      this.syncDeleteToImap(email.accountId, email.imapUid, email.folder);
    }

    return this.emailRepo.delete(id);
  }

  async bulkDeleteEmails(ids: string[]): Promise<number> {
    // Fetch all emails to get their IMAP UIDs before deleting from DB
    const emailsToDelete: Email[] = [];
    for (const id of ids) {
      const email = await this.emailRepo.findById(id);
      if (email) emailsToDelete.push(email);
    }

    if (emailsToDelete.length === 0) return 0;

    // Group by account+folder for efficient IMAP bulk delete (1 connection per account)
    const groups = new Map<string, { accountId: string; folder: string; uids: number[] }>();
    for (const email of emailsToDelete) {
      if (!email.imapUid) continue;
      const key = `${email.accountId}:${email.folder}`;
      const group = groups.get(key) || { accountId: email.accountId, folder: email.folder, uids: [] };
      group.uids.push(email.imapUid);
      groups.set(key, group);
    }

    // Bulk delete from IMAP (1 connection per account/folder)
    for (const group of groups.values()) {
      try {
        const account = await this.accountRepo.findById(group.accountId);
        const password = account ? await this.accountRepo.getPassword(group.accountId) : null;
        if (account && password) {
          await this.imapConnector.bulkDeleteMessages(account, password, group.uids, group.folder);
        }
      } catch (err) {
        console.error(`[email-sync] Failed to bulk delete from IMAP (${group.uids.length} msgs):`, err);
      }
    }

    // Delete from DB
    let count = 0;
    for (const email of emailsToDelete) {
      const deleted = await this.emailRepo.delete(email.id);
      if (deleted) count++;
    }

    return count;
  }

  /** Fire-and-forget: push a flag change to IMAP server */
  private async syncFlagToImap(accountId: string, uid: number, folder: string, flagType: "seen" | "flagged", value: boolean): Promise<void> {
    try {
      const account = await this.accountRepo.findById(accountId);
      const password = account ? await this.accountRepo.getPassword(accountId) : null;
      if (!account || !password) return;

      if (flagType === "seen") {
        if (value) {
          await this.imapConnector.markRead(account, password, uid, folder);
        } else {
          await this.imapConnector.markUnread(account, password, uid, folder);
        }
      } else {
        if (value) {
          await this.imapConnector.markStarred(account, password, uid, folder);
        } else {
          await this.imapConnector.markUnstarred(account, password, uid, folder);
        }
      }
    } catch (err) {
      console.error(`[email-sync] Failed to sync ${flagType} flag to IMAP (uid=${uid}):`, err);
    }
  }

  /** Fire-and-forget: delete message from IMAP server */
  private async syncDeleteToImap(accountId: string, uid: number, folder: string): Promise<void> {
    try {
      const account = await this.accountRepo.findById(accountId);
      const password = account ? await this.accountRepo.getPassword(accountId) : null;
      if (!account || !password) return;

      await this.imapConnector.deleteMessage(account, password, uid, folder);
    } catch (err) {
      console.error(`[email-sync] Failed to delete from IMAP (uid=${uid}):`, err);
    }
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

    // 1. Fetch new emails (incremental by UID)
    const maxUid = await this.emailRepo.findMaxUid(accountId, "INBOX");
    const rawEmails = await this.imapConnector.fetchNewEmails(account, password, "INBOX", maxUid ?? undefined);
    let newEmails = await this.emailRepo.bulkCreate(rawEmails);

    // 2. Reconcile: re-import emails that exist on IMAP but not in DB
    const reconciled = await this.reconcileMissing(account, password, "INBOX");
    newEmails += reconciled;

    // 3. Sync flags (IMAP → DB)
    await this.syncFlags(account, password, "INBOX");

    // 4. Apply email rules to newly imported emails
    if (this.emailRuleService && newEmails > 0) {
      await this.applyRulesToRecent(accountId, newEmails);
    }

    await this.accountRepo.updateLastSyncedAt(accountId, new Date());

    return { newEmails };
  }

  /** Sync flags from IMAP to DB: IMAP is source of truth during background sync */
  private async syncFlags(account: EmailAccount, password: string, folder: string): Promise<void> {
    try {
      // 1. Get current DB flags (lightweight query)
      const dbFlags = await this.emailRepo.findFlagsByAccount(account.id, folder, 200);
      const withUid = dbFlags.filter((e) => e.imapUid !== null);
      if (withUid.length === 0) return;

      // 2. Fetch current IMAP flags
      const uids = withUid.map((e) => e.imapUid!);
      const imapFlags = await this.imapConnector.fetchFlags(account, password, folder, uids);

      // 3. Compare and build updates
      const updates: Array<{ id: string; isRead?: boolean; isStarred?: boolean }> = [];
      for (const dbEmail of withUid) {
        const imap = imapFlags.get(dbEmail.imapUid!);
        if (!imap) continue;

        const patch: { id: string; isRead?: boolean; isStarred?: boolean } = { id: dbEmail.id };
        if (imap.seen !== dbEmail.isRead) patch.isRead = imap.seen;
        if (imap.flagged !== dbEmail.isStarred) patch.isStarred = imap.flagged;

        if (patch.isRead !== undefined || patch.isStarred !== undefined) {
          updates.push(patch);
        }
      }

      // 4. Bulk update DB
      if (updates.length > 0) {
        const updated = await this.emailRepo.bulkUpdateFlags(updates);
        console.log(`[email-sync] Synced ${updated} flag changes from IMAP for ${account.label}`);
      }
    } catch (err) {
      console.error(`[email-sync] Failed to sync flags for ${account.label}:`, err);
    }
  }

  /** Re-import emails that exist on IMAP but were deleted locally (failed IMAP delete) */
  private async reconcileMissing(account: EmailAccount, password: string, folder: string): Promise<number> {
    try {
      // 1. Get UIDs on IMAP (last 30 days) + UIDs in DB
      const [imapUids, dbUids] = await Promise.all([
        this.imapConnector.listRecentUids(account, password, folder, 30),
        this.emailRepo.findUidsByAccount(account.id, folder),
      ]);
      if (imapUids.length === 0) return 0;

      // 2. Find missing: on IMAP but not in DB
      const dbUidSet = new Set(dbUids);
      const missingUids = imapUids.filter((uid) => !dbUidSet.has(uid));
      if (missingUids.length === 0) return 0;

      // 3. Fetch only the missing emails (cap at 50 to avoid overload)
      const toFetch = missingUids.slice(-50);
      const rawEmails = await this.imapConnector.fetchByUids(account, password, folder, toFetch);

      if (rawEmails.length === 0) return 0;

      const imported = await this.emailRepo.bulkCreate(rawEmails);
      if (imported > 0) {
        console.log(`[email-sync] Reconciled ${imported} missing emails for ${account.label}`);
      }
      return imported;
    } catch (err) {
      console.error(`[email-sync] Failed to reconcile missing emails for ${account.label}:`, err);
      return 0;
    }
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
    const bySender = new Map<string, { senderAddress: string; count: number; subjects: string[]; emailIds: string[] }>();
    for (const email of recent) {
      const sender = email.fromName || email.fromAddress;
      const entry = bySender.get(sender) || { senderAddress: email.fromAddress, count: 0, subjects: [], emailIds: [] };
      entry.count++;
      entry.emailIds.push(email.id);
      if (entry.subjects.length < 3) entry.subjects.push(email.subject || "(sans sujet)");
      bySender.set(sender, entry);
    }

    return {
      totalUnread: recent.length,
      period: { from: since.toISOString(), to: new Date().toISOString() },
      bySender: Array.from(bySender.entries())
        .map(([sender, data]) => ({
          sender,
          senderAddress: data.senderAddress,
          count: data.count,
          subjects: data.subjects,
          emailIds: data.emailIds,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async generateReport(days: number, llmService: LlmService): Promise<{ markdown: string; emailCount: number }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Fetch recent emails (all, not just unread)
    const allEmails = await this.emailRepo.findAll({ limit: 200 });
    const recent = allEmails.filter((e) => new Date(e.sentAt) >= since);

    if (recent.length === 0) {
      return { markdown: `# Rapport emails\n\nAucun email sur les ${days} derniers jours.`, emailCount: 0 };
    }

    // Build a structured summary of each email for the LLM
    const emailSummaries = recent.map((e) => {
      let body = e.bodyText || "";
      if (!body && e.bodyHtml) {
        body = e.bodyHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      }
      // Truncate to keep context manageable
      if (body.length > 800) body = body.substring(0, 800) + "...";

      return {
        from: e.fromName ? `${e.fromName} <${e.fromAddress}>` : e.fromAddress,
        subject: e.subject || "(sans sujet)",
        date: new Date(e.sentAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
        isRead: e.isRead,
        isStarred: e.isStarred,
        classification: e.classification || null,
        body,
      };
    });

    const prompt = `Voici ${recent.length} emails des ${days} derniers jours. Analyse-les et genere un rapport en markdown structure.

Le rapport doit contenir :
1. **Resume executif** (3-5 lignes) : vue d'ensemble de la boite mail
2. **Emails importants** : identifie les emails qui necessitent une action ou attention (factures, demandes, deadlines). Pour chacun, indique l'expediteur, le sujet, et l'action requise.
3. **Par categorie** : groupe les emails par theme (newsletters, notifications, personnel, professionnel, etc.)
4. **Actions recommandees** : liste les actions concretes a faire

Format markdown propre avec titres, listes, et gras pour les points cles. Ecris en francais.`;

    const markdown = await llmService.generateNarrative(
      JSON.stringify(emailSummaries, null, 2),
      prompt,
    );

    return { markdown, emailCount: recent.length };
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
