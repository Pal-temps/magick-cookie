import type { EmailAccount, Email, CreateEmailAccountInput, UpdateEmailAccountInput, CreateEmailInput } from "./email.entity";

export interface EmailAccountRepository {
  findAll(): Promise<EmailAccount[]>;
  findById(id: string): Promise<EmailAccount | null>;
  findActive(): Promise<EmailAccount[]>;
  create(input: CreateEmailAccountInput): Promise<EmailAccount>;
  update(id: string, input: UpdateEmailAccountInput): Promise<EmailAccount | null>;
  updateLastSyncedAt(id: string, date: Date): Promise<void>;
  delete(id: string): Promise<boolean>;
  getPassword(id: string): Promise<string | null>;
}

export interface EmailRepository {
  findByAccount(accountId: string, options?: { folder?: string; unread?: boolean; limit?: number; offset?: number }): Promise<Email[]>;
  findAll(options?: { folder?: string; unread?: boolean; limit?: number; offset?: number }): Promise<Email[]>;
  findById(id: string): Promise<Email | null>;
  findByIds(ids: string[]): Promise<Email[]>;
  findMaxUid(accountId: string, folder: string): Promise<number | null>;
  create(input: CreateEmailInput): Promise<Email | null>;
  bulkCreate(inputs: CreateEmailInput[]): Promise<number>;
  updateFlags(id: string, flags: { isRead?: boolean; isStarred?: boolean; isArchived?: boolean }): Promise<Email | null>;
  updateFolder(id: string, folder: string): Promise<Email | null>;
  delete(id: string): Promise<boolean>;
  countUnread(accountId?: string): Promise<number>;
  countByDateRange(from: Date, to: Date): Promise<{ total: number; unread: number; dailyStats: { date: string; count: number }[] }>;
  updateSummary(id: string, summary: string, classification?: string): Promise<Email | null>;
  findUidsByAccount(accountId: string, folder: string): Promise<number[]>;
  findFlagsByAccount(accountId: string, folder: string, limit?: number): Promise<Array<{ id: string; imapUid: number | null; isRead: boolean; isStarred: boolean }>>;
  bulkUpdateFlags(updates: Array<{ id: string; isRead?: boolean; isStarred?: boolean }>): Promise<number>;
}
