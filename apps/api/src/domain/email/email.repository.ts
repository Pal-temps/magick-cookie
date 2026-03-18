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
  findMaxUid(accountId: string, folder: string): Promise<number | null>;
  create(input: CreateEmailInput): Promise<Email | null>;
  bulkCreate(inputs: CreateEmailInput[]): Promise<number>;
  updateFlags(id: string, flags: { isRead?: boolean; isStarred?: boolean; isArchived?: boolean }): Promise<Email | null>;
  delete(id: string): Promise<boolean>;
  countUnread(accountId?: string): Promise<number>;
  countByDateRange(from: Date, to: Date): Promise<{ total: number; unread: number; dailyStats: { date: string; count: number }[] }>;
  updateSummary(id: string, summary: string, classification?: string): Promise<Email | null>;
}
