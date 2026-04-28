import { eq, and, desc, gte, lte, inArray, sql } from "drizzle-orm";
import type { Database } from "../database/client";
import { emails } from "../database/schema";
import type { EmailRepository } from "../../domain/email/email.repository";
import type { Email, CreateEmailInput, EmailAddress } from "../../domain/email/email.entity";

export class DrizzleEmailRepository implements EmailRepository {
  constructor(private db: Database) {}

  async findByAccount(
    accountId: string,
    options?: { folder?: string; unread?: boolean; limit?: number; offset?: number },
  ): Promise<Email[]> {
    const conditions = [eq(emails.accountId, accountId)];
    if (options?.folder) conditions.push(eq(emails.folder, options.folder));
    if (options?.unread) conditions.push(eq(emails.isRead, false));

    const rows = await this.db.select().from(emails)
      .where(and(...conditions))
      .orderBy(desc(emails.sentAt))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);

    return rows.map(this.toDomain);
  }

  async findAll(
    options?: { folder?: string; unread?: boolean; limit?: number; offset?: number },
  ): Promise<Email[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (options?.folder) conditions.push(eq(emails.folder, options.folder));
    if (options?.unread) conditions.push(eq(emails.isRead, false));

    const query = this.db.select().from(emails);
    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query)
      .orderBy(desc(emails.sentAt))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);

    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<Email | null> {
    const rows = await this.db.select().from(emails).where(eq(emails.id, id)).limit(1);
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<Email[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select().from(emails).where(inArray(emails.id, ids));
    return rows.map(this.toDomain);
  }

  async findMaxUid(accountId: string, folder: string): Promise<number | null> {
    const rows = await this.db.select({ maxUid: sql<number>`MAX(${emails.imapUid})` })
      .from(emails)
      .where(and(eq(emails.accountId, accountId), eq(emails.folder, folder)));
    return rows[0]?.maxUid ?? null;
  }

  async create(input: CreateEmailInput): Promise<Email | null> {
    try {
      const rows = await this.db.insert(emails).values({
        accountId: input.accountId,
        messageId: input.messageId,
        imapUid: input.imapUid,
        subject: input.subject,
        fromAddress: input.fromAddress,
        fromName: input.fromName,
        toAddresses: JSON.stringify(input.toAddresses),
        ccAddresses: JSON.stringify(input.ccAddresses),
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml,
        hasAttachments: input.hasAttachments,
        attachmentNames: JSON.stringify(input.attachmentNames),
        isRead: input.isRead,
        folder: input.folder,
        sentAt: input.sentAt,
      }).onConflictDoNothing().returning();

      return rows.length > 0 ? this.toDomain(rows[0]) : null;
    } catch {
      return null; // duplicate message_id
    }
  }

  async bulkCreate(inputs: CreateEmailInput[]): Promise<number> {
    let count = 0;
    for (const input of inputs) {
      const result = await this.create(input);
      if (result) count++;
    }
    return count;
  }

  async updateFlags(
    id: string,
    flags: { isRead?: boolean; isStarred?: boolean; isArchived?: boolean },
  ): Promise<Email | null> {
    const rows = await this.db.update(emails)
      .set(flags)
      .where(eq(emails.id, id))
      .returning();
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async updateFolder(id: string, folder: string): Promise<Email | null> {
    const rows = await this.db.update(emails)
      .set({ folder })
      .where(eq(emails.id, id))
      .returning();
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(emails).where(eq(emails.id, id)).returning();
    return rows.length > 0;
  }

  async countUnread(accountId?: string): Promise<number> {
    const conditions = [eq(emails.isRead, false)];
    if (accountId) conditions.push(eq(emails.accountId, accountId));

    const rows = await this.db.select({ count: sql<number>`COUNT(*)` })
      .from(emails)
      .where(and(...conditions));
    return Number(rows[0]?.count ?? 0);
  }

  async updateSummary(id: string, summary: string, classification?: string): Promise<Email | null> {
    const updates: Record<string, unknown> = { summary };
    if (classification !== undefined) updates.classification = classification;

    const rows = await this.db.update(emails)
      .set(updates)
      .where(eq(emails.id, id))
      .returning();
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async countByDateRange(from: Date, to: Date): Promise<{ total: number; unread: number; dailyStats: { date: string; count: number }[] }> {
    const totalRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emails)
      .where(and(gte(emails.sentAt, from), lte(emails.sentAt, to)));

    const unreadRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emails)
      .where(and(gte(emails.sentAt, from), lte(emails.sentAt, to), eq(emails.isRead, false)));

    const dailyRows = await this.db
      .select({
        date: sql<string>`to_char(${emails.sentAt}::date, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(emails)
      .where(and(gte(emails.sentAt, from), lte(emails.sentAt, to)))
      .groupBy(sql`${emails.sentAt}::date`)
      .orderBy(sql`${emails.sentAt}::date`);

    return {
      total: Number(totalRows[0]?.count ?? 0),
      unread: Number(unreadRows[0]?.count ?? 0),
      dailyStats: dailyRows.map((r) => ({ date: r.date, count: Number(r.count) })),
    };
  }

  async findUidsByAccount(accountId: string, folder: string): Promise<number[]> {
    const rows = await this.db
      .select({ imapUid: emails.imapUid })
      .from(emails)
      .where(and(eq(emails.accountId, accountId), eq(emails.folder, folder)));

    return rows
      .map((r) => r.imapUid)
      .filter((uid): uid is number => uid !== null);
  }

  async findFlagsByAccount(
    accountId: string,
    folder: string,
    limit: number = 200,
  ): Promise<Array<{ id: string; imapUid: number | null; isRead: boolean; isStarred: boolean }>> {
    const rows = await this.db
      .select({
        id: emails.id,
        imapUid: emails.imapUid,
        isRead: emails.isRead,
        isStarred: emails.isStarred,
      })
      .from(emails)
      .where(and(eq(emails.accountId, accountId), eq(emails.folder, folder)))
      .orderBy(desc(emails.sentAt))
      .limit(limit);

    return rows;
  }

  async bulkUpdateFlags(
    updates: Array<{ id: string; isRead?: boolean; isStarred?: boolean }>,
  ): Promise<number> {
    let count = 0;
    for (const update of updates) {
      const flags: Record<string, boolean> = {};
      if (update.isRead !== undefined) flags.isRead = update.isRead;
      if (update.isStarred !== undefined) flags.isStarred = update.isStarred;
      if (Object.keys(flags).length === 0) continue;

      const rows = await this.db.update(emails)
        .set(flags)
        .where(eq(emails.id, update.id))
        .returning({ id: emails.id });
      if (rows.length > 0) count++;
    }
    return count;
  }

  private toDomain(row: typeof emails.$inferSelect): Email {
    return {
      id: row.id,
      accountId: row.accountId,
      messageId: row.messageId,
      imapUid: row.imapUid,
      subject: row.subject,
      fromAddress: row.fromAddress,
      fromName: row.fromName,
      toAddresses: safeJsonParse<EmailAddress[]>(row.toAddresses, []),
      ccAddresses: safeJsonParse<EmailAddress[]>(row.ccAddresses, []),
      bodyText: row.bodyText,
      bodyHtml: row.bodyHtml,
      hasAttachments: row.hasAttachments,
      attachmentNames: safeJsonParse<string[]>(row.attachmentNames, []),
      isRead: row.isRead,
      isStarred: row.isStarred,
      isArchived: row.isArchived,
      folder: row.folder,
      summary: row.summary ?? null,
      classification: row.classification ?? null,
      sentAt: row.sentAt,
      createdAt: row.createdAt!,
    };
  }
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
