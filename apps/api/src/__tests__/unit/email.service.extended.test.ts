import { describe, test, expect, beforeEach, mock } from "bun:test";
import { EmailService } from "../../application/email/email.service";
import type { EmailAccountRepository, EmailRepository } from "../../domain/email/email.repository";
import type { Email, EmailAccount } from "../../domain/email/email.entity";
import type { ImapConnector } from "../../infrastructure/connectors/imap.connector";

function makeAccount(overrides: Partial<EmailAccount> = {}): EmailAccount {
  return { id: "acc-1", label: "Perso", email: "john@gmail.com", imapHost: "imap.gmail.com", imapPort: 993, imapSecure: true, smtpHost: "smtp.gmail.com", smtpPort: 587, smtpSecure: false, username: "john@gmail.com", lastSyncedAt: null, syncEnabled: true, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), ...overrides };
}

function makeEmail(overrides: Partial<Email> = {}): Email {
  return { id: "email-1", accountId: "acc-1", messageId: "<msg@gmail.com>", imapUid: 100, subject: "Test", fromAddress: "alice@example.com", fromName: "Alice", toAddresses: [], ccAddresses: [], bodyText: "Hello", bodyHtml: null, hasAttachments: false, attachmentNames: [], isRead: false, isStarred: false, isArchived: false, folder: "INBOX", summary: null, classification: null, sentAt: new Date("2026-03-15T10:00:00Z"), createdAt: new Date("2026-03-15T10:01:00Z"), ...overrides };
}

function createMocks() {
  const accountRepo = { findAll: mock(() => Promise.resolve([])), findById: mock(() => Promise.resolve(null)), findActive: mock(() => Promise.resolve([])), create: mock(() => Promise.resolve(makeAccount())), update: mock(() => Promise.resolve(null)), updateLastSyncedAt: mock(() => Promise.resolve()), delete: mock(() => Promise.resolve(false)), getPassword: mock(() => Promise.resolve(null)) } as unknown as EmailAccountRepository & Record<string, any>;
  const emailRepo = { findByAccount: mock(() => Promise.resolve([])), findAll: mock(() => Promise.resolve([])), findById: mock(() => Promise.resolve(null)), findMaxUid: mock(() => Promise.resolve(null)), create: mock(() => Promise.resolve(null)), bulkCreate: mock(() => Promise.resolve(0)), updateFlags: mock(() => Promise.resolve(null)), delete: mock(() => Promise.resolve(false)), countUnread: mock(() => Promise.resolve(0)), countByDateRange: mock(() => Promise.resolve({ total: 0, unread: 0, dailyStats: [] })), updateSummary: mock(() => Promise.resolve(null)) } as unknown as EmailRepository & Record<string, any>;
  const imapConnector = { fetchNewEmails: mock(() => Promise.resolve([])), testConnection: mock(() => Promise.resolve(true)), markRead: mock(() => Promise.resolve()), deleteMessage: mock(() => Promise.resolve()) } as unknown as ImapConnector;
  return { accountRepo, emailRepo, imapConnector };
}

describe("EmailService — Extended", () => {
  let service: EmailService;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
    service = new EmailService(mocks.accountRepo as any, mocks.emailRepo as any, mocks.imapConnector as any);
  });

  describe("getAccountById", () => {
    test("returns account when found", async () => {
      (mocks.accountRepo as any).findById.mockReturnValue(Promise.resolve(makeAccount()));
      const result = await service.getAccountById("acc-1");
      expect(result).toBeDefined();
      expect(result!.id).toBe("acc-1");
    });

    test("returns null when not found", async () => {
      const result = await service.getAccountById("ghost");
      expect(result).toBeNull();
    });
  });

  describe("updateSummary", () => {
    test("delegates to emailRepo", async () => {
      const updated = makeEmail({ summary: "Brief", classification: "newsletter" });
      (mocks.emailRepo as any).updateSummary.mockReturnValue(Promise.resolve(updated));
      const result = await service.updateSummary("email-1", "Brief", "newsletter");
      expect(result).toEqual(updated);
    });

    test("returns null when not found", async () => {
      const result = await service.updateSummary("ghost", "summary");
      expect(result).toBeNull();
    });
  });

  describe("getDigest", () => {
    test("groups emails by sender sorted by count", async () => {
      const recent = new Date(); recent.setDate(recent.getDate() - 2);
      (mocks.emailRepo as any).findAll.mockReturnValue(Promise.resolve([
        makeEmail({ id: "e1", fromName: "Alice", subject: "Hello", sentAt: recent }),
        makeEmail({ id: "e2", fromName: "Alice", subject: "Follow-up", sentAt: recent }),
        makeEmail({ id: "e3", fromName: "Bob", subject: "Meeting", sentAt: recent }),
      ]));
      const result = await service.getDigest();
      expect(result.totalUnread).toBe(3);
      expect(result.bySender[0].sender).toBe("Alice");
      expect(result.bySender[0].count).toBe(2);
    });

    test("filters old emails", async () => {
      const old = new Date(); old.setDate(old.getDate() - 10);
      const recent = new Date();
      (mocks.emailRepo as any).findAll.mockReturnValue(Promise.resolve([
        makeEmail({ id: "e1", sentAt: recent }),
        makeEmail({ id: "e2", sentAt: old }),
      ]));
      const result = await service.getDigest(3);
      expect(result.totalUnread).toBe(1);
    });

    test("returns empty when no emails", async () => {
      const result = await service.getDigest();
      expect(result.totalUnread).toBe(0);
      expect(result.bySender).toEqual([]);
    });

    test("uses fromAddress when fromName is null", async () => {
      const recent = new Date();
      (mocks.emailRepo as any).findAll.mockReturnValue(Promise.resolve([
        makeEmail({ fromName: null, fromAddress: "noreply@ex.com", sentAt: recent }),
      ]));
      const result = await service.getDigest();
      expect(result.bySender[0].sender).toBe("noreply@ex.com");
    });

    test("limits subjects to 3", async () => {
      const recent = new Date();
      (mocks.emailRepo as any).findAll.mockReturnValue(Promise.resolve([
        makeEmail({ id: "1", fromName: "A", subject: "S1", sentAt: recent }),
        makeEmail({ id: "2", fromName: "A", subject: "S2", sentAt: recent }),
        makeEmail({ id: "3", fromName: "A", subject: "S3", sentAt: recent }),
        makeEmail({ id: "4", fromName: "A", subject: "S4", sentAt: recent }),
      ]));
      const result = await service.getDigest();
      expect(result.bySender[0].subjects).toHaveLength(3);
    });
  });

  describe("syncAll edge cases", () => {
    test("no active accounts", async () => {
      const result = await service.syncAll();
      expect(result.total).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    test("captures error messages", async () => {
      (mocks.accountRepo as any).findActive.mockReturnValue(Promise.resolve([makeAccount()]));
      // findById returns null -> throws "Account not found"
      const result = await service.syncAll();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Account not found");
    });
  });
});
