import { describe, test, expect, beforeEach, mock } from "bun:test";
import { EmailService } from "../../application/email/email.service";
import type { EmailAccountRepository, EmailRepository } from "../../domain/email/email.repository";
import type { EmailAccount, Email, CreateEmailAccountInput, CreateEmailInput } from "../../domain/email/email.entity";
import type { ImapConnector } from "../../infrastructure/connectors/imap.connector";
import type { SmtpConnector } from "../../infrastructure/connectors/smtp.connector";

// --- Factories ---

function makeAccount(overrides: Partial<EmailAccount> = {}): EmailAccount {
  return {
    id: "acc-1",
    label: "Perso",
    email: "john@gmail.com",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: false,
    username: "john@gmail.com",
    selfSigned: false,
    lastSyncedAt: null,
    syncEnabled: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeEmail(overrides: Partial<Email> = {}): Email {
  return {
    id: "email-1",
    accountId: "acc-1",
    messageId: "<msg-1@gmail.com>",
    imapUid: 100,
    subject: "Test subject",
    fromAddress: "alice@example.com",
    fromName: "Alice",
    toAddresses: [{ name: "John", address: "john@gmail.com" }],
    ccAddresses: [],
    bodyText: "Hello world",
    bodyHtml: "<p>Hello world</p>",
    hasAttachments: false,
    attachmentNames: [],
    isRead: false,
    isStarred: false,
    isArchived: false,
    folder: "INBOX",
    summary: null,
    classification: null,
    sentAt: new Date("2026-03-15T10:00:00Z"),
    createdAt: new Date("2026-03-15T10:01:00Z"),
    ...overrides,
  };
}

// --- Mock repos ---

function createMockAccountRepo(): Record<keyof EmailAccountRepository, ReturnType<typeof mock>> {
  return {
    findAll: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    findActive: mock(() => Promise.resolve([])),
    create: mock(() => Promise.resolve(makeAccount())),
    update: mock(() => Promise.resolve(null)),
    updateLastSyncedAt: mock(() => Promise.resolve()),
    delete: mock(() => Promise.resolve(false)),
    getPassword: mock(() => Promise.resolve(null)),
  };
}

function createMockEmailRepo(): Record<keyof EmailRepository, ReturnType<typeof mock>> {
  return {
    findByAccount: mock(() => Promise.resolve([])),
    findAll: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    findMaxUid: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve(null)),
    bulkCreate: mock(() => Promise.resolve(0)),
    updateFlags: mock(() => Promise.resolve(null)),
    delete: mock(() => Promise.resolve(false)),
    countUnread: mock(() => Promise.resolve(0)),
    countByDateRange: mock(() => Promise.resolve({ total: 0, unread: 0, dailyStats: [] })),
    updateSummary: mock(() => Promise.resolve(null)),
    findUidsByAccount: mock(() => Promise.resolve([])),
    findFlagsByAccount: mock(() => Promise.resolve([])),
    bulkUpdateFlags: mock(() => Promise.resolve(0)),
  };
}

function createMockImapConnector(): Record<keyof ImapConnector, ReturnType<typeof mock>> {
  return {
    fetchNewEmails: mock(() => Promise.resolve([])),
    testConnection: mock(() => Promise.resolve(true)),
    markRead: mock(() => Promise.resolve()),
    markUnread: mock(() => Promise.resolve()),
    markStarred: mock(() => Promise.resolve()),
    markUnstarred: mock(() => Promise.resolve()),
    deleteMessage: mock(() => Promise.resolve()),
    bulkDeleteMessages: mock(() => Promise.resolve(0)),
    fetchByUids: mock(() => Promise.resolve([])),
    listRecentUids: mock(() => Promise.resolve([])),
    fetchFlags: mock(() => Promise.resolve(new Map())),
  };
}

function createMockSmtpConnector(): Record<keyof SmtpConnector, ReturnType<typeof mock>> {
  return {
    sendEmail: mock(() => Promise.resolve({ messageId: "<sent@test.com>" })),
    testConnection: mock(() => Promise.resolve(true)),
  };
}

// --- Tests ---

describe("EmailService", () => {
  let service: EmailService;
  let accountRepo: ReturnType<typeof createMockAccountRepo>;
  let emailRepo: ReturnType<typeof createMockEmailRepo>;
  let imapConnector: ReturnType<typeof createMockImapConnector>;
  let smtpConnector: ReturnType<typeof createMockSmtpConnector>;

  beforeEach(() => {
    accountRepo = createMockAccountRepo();
    emailRepo = createMockEmailRepo();
    imapConnector = createMockImapConnector();
    smtpConnector = createMockSmtpConnector();
    service = new EmailService(
      accountRepo as unknown as EmailAccountRepository,
      emailRepo as unknown as EmailRepository,
      imapConnector as unknown as ImapConnector,
      smtpConnector as unknown as SmtpConnector,
    );
  });

  // --- Accounts ---

  describe("getAccounts", () => {
    test("returns all accounts from repo", async () => {
      const accounts = [makeAccount(), makeAccount({ id: "acc-2", label: "Pro" })];
      accountRepo.findAll.mockReturnValue(Promise.resolve(accounts));

      const result = await service.getAccounts();
      expect(result).toEqual(accounts);
      expect(accountRepo.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("getActiveAccounts", () => {
    test("returns only active accounts", async () => {
      const active = [makeAccount()];
      accountRepo.findActive.mockReturnValue(Promise.resolve(active));

      const result = await service.getActiveAccounts();
      expect(result).toEqual(active);
      expect(accountRepo.findActive).toHaveBeenCalledTimes(1);
    });
  });

  describe("createAccount", () => {
    test("creates account via repo", async () => {
      const input: CreateEmailAccountInput = {
        label: "Perso",
        email: "john@gmail.com",
        imapHost: "imap.gmail.com",
        imapPort: 993,
        imapSecure: true,
        smtpHost: "smtp.gmail.com",
        smtpPort: 587,
        smtpSecure: false,
        username: "john@gmail.com",
        password: "secret",
      };
      const created = makeAccount();
      accountRepo.create.mockReturnValue(Promise.resolve(created));

      const result = await service.createAccount(input);
      expect(result).toEqual(created);
      expect(accountRepo.create).toHaveBeenCalledWith(input);
    });
  });

  describe("deleteAccount", () => {
    test("returns true when deleted", async () => {
      accountRepo.delete.mockReturnValue(Promise.resolve(true));
      const result = await service.deleteAccount("acc-1");
      expect(result).toBe(true);
    });

    test("returns false when not found", async () => {
      accountRepo.delete.mockReturnValue(Promise.resolve(false));
      const result = await service.deleteAccount("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("testConnection", () => {
    test("tests both IMAP and SMTP", async () => {
      imapConnector.testConnection.mockReturnValue(Promise.resolve(true));
      smtpConnector.testConnection.mockReturnValue(Promise.resolve(true));

      const input: CreateEmailAccountInput = {
        label: "Test",
        email: "test@gmail.com",
        imapHost: "imap.gmail.com",
        imapPort: 993,
        imapSecure: true,
        smtpHost: "smtp.gmail.com",
        smtpPort: 587,
        smtpSecure: false,
        username: "test@gmail.com",
        password: "secret",
      };

      const result = await service.testConnection(input);
      expect(result).toEqual({ imap: true, smtp: true });
      expect(imapConnector.testConnection).toHaveBeenCalledWith({
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        username: "test@gmail.com",
        password: "secret",
        selfSigned: undefined,
      });
      expect(smtpConnector.testConnection).toHaveBeenCalledWith({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        username: "test@gmail.com",
        password: "secret",
        selfSigned: undefined,
      });
    });

    test("returns partial failure when SMTP fails", async () => {
      imapConnector.testConnection.mockReturnValue(Promise.resolve(true));
      smtpConnector.testConnection.mockReturnValue(Promise.resolve(false));

      const input: CreateEmailAccountInput = {
        label: "Test",
        email: "test@gmail.com",
        imapHost: "imap.gmail.com",
        imapPort: 993,
        imapSecure: true,
        smtpHost: "smtp.gmail.com",
        smtpPort: 587,
        smtpSecure: false,
        username: "test@gmail.com",
        password: "secret",
      };

      const result = await service.testConnection(input);
      expect(result).toEqual({ imap: true, smtp: false });
    });

    test("passes selfSigned to both connectors", async () => {
      imapConnector.testConnection.mockReturnValue(Promise.resolve(true));
      smtpConnector.testConnection.mockReturnValue(Promise.resolve(true));

      const input: CreateEmailAccountInput = {
        label: "Self-hosted",
        email: "me@localhost",
        imapHost: "localhost",
        imapPort: 1993,
        imapSecure: true,
        smtpHost: "localhost",
        smtpPort: 1587,
        smtpSecure: false,
        username: "me@localhost",
        password: "secret",
        selfSigned: true,
      };

      await service.testConnection(input);
      expect(imapConnector.testConnection).toHaveBeenCalledWith(expect.objectContaining({ selfSigned: true }));
      expect(smtpConnector.testConnection).toHaveBeenCalledWith(expect.objectContaining({ selfSigned: true }));
    });
  });

  // --- Emails ---

  describe("getEmails", () => {
    test("returns all emails when no accountId", async () => {
      const emails = [makeEmail(), makeEmail({ id: "email-2" })];
      emailRepo.findAll.mockReturnValue(Promise.resolve(emails));

      const result = await service.getEmails({ folder: "INBOX" });
      expect(result).toEqual(emails);
      expect(emailRepo.findAll).toHaveBeenCalledTimes(1);
    });

    test("filters by account when accountId provided", async () => {
      const emails = [makeEmail()];
      emailRepo.findByAccount.mockReturnValue(Promise.resolve(emails));

      const result = await service.getEmails({ accountId: "acc-1", folder: "INBOX" });
      expect(result).toEqual(emails);
      expect(emailRepo.findByAccount).toHaveBeenCalledTimes(1);
    });
  });

  // --- Mark as read ---

  describe("mark as read", () => {
    test("marks an unread email as read", async () => {
      const updated = makeEmail({ isRead: true });
      emailRepo.updateFlags.mockReturnValue(Promise.resolve(updated));

      const result = await service.updateEmailFlags("email-1", { isRead: true });
      expect(result!.isRead).toBe(true);
      expect(emailRepo.updateFlags).toHaveBeenCalledWith("email-1", { isRead: true });
    });

    test("marks a read email as unread", async () => {
      const updated = makeEmail({ isRead: false });
      emailRepo.updateFlags.mockReturnValue(Promise.resolve(updated));

      const result = await service.updateEmailFlags("email-1", { isRead: false });
      expect(result!.isRead).toBe(false);
      expect(emailRepo.updateFlags).toHaveBeenCalledWith("email-1", { isRead: false });
    });

    test("returns null when email does not exist", async () => {
      emailRepo.updateFlags.mockReturnValue(Promise.resolve(null));

      const result = await service.updateEmailFlags("ghost", { isRead: true });
      expect(result).toBeNull();
    });
  });

  // --- Star / unstar ---

  describe("star / unstar", () => {
    test("stars an email", async () => {
      const updated = makeEmail({ isStarred: true });
      emailRepo.updateFlags.mockReturnValue(Promise.resolve(updated));

      const result = await service.updateEmailFlags("email-1", { isStarred: true });
      expect(result!.isStarred).toBe(true);
      expect(emailRepo.updateFlags).toHaveBeenCalledWith("email-1", { isStarred: true });
    });

    test("unstars an email", async () => {
      const updated = makeEmail({ isStarred: false });
      emailRepo.updateFlags.mockReturnValue(Promise.resolve(updated));

      const result = await service.updateEmailFlags("email-1", { isStarred: false });
      expect(result!.isStarred).toBe(false);
    });
  });

  // --- Archive ---

  describe("archive", () => {
    test("archives an email by setting isArchived flag", async () => {
      const updated = makeEmail({ isArchived: true });
      emailRepo.updateFlags.mockReturnValue(Promise.resolve(updated));

      const result = await service.updateEmailFlags("email-1", { isArchived: true });
      expect(result!.isArchived).toBe(true);
      expect(emailRepo.updateFlags).toHaveBeenCalledWith("email-1", { isArchived: true });
    });

    test("unarchives an email", async () => {
      const updated = makeEmail({ isArchived: false });
      emailRepo.updateFlags.mockReturnValue(Promise.resolve(updated));

      const result = await service.updateEmailFlags("email-1", { isArchived: false });
      expect(result!.isArchived).toBe(false);
    });

    test("archive returns null for nonexistent email", async () => {
      emailRepo.updateFlags.mockReturnValue(Promise.resolve(null));

      const result = await service.updateEmailFlags("ghost", { isArchived: true });
      expect(result).toBeNull();
    });
  });

  // --- Combined flag updates ---

  describe("combined flag updates", () => {
    test("marks as read and starred in one call", async () => {
      const updated = makeEmail({ isRead: true, isStarred: true });
      emailRepo.updateFlags.mockReturnValue(Promise.resolve(updated));

      const result = await service.updateEmailFlags("email-1", { isRead: true, isStarred: true });
      expect(result!.isRead).toBe(true);
      expect(result!.isStarred).toBe(true);
      expect(emailRepo.updateFlags).toHaveBeenCalledWith("email-1", { isRead: true, isStarred: true });
    });

    test("archives and marks as read in one call", async () => {
      const updated = makeEmail({ isRead: true, isArchived: true });
      emailRepo.updateFlags.mockReturnValue(Promise.resolve(updated));

      const result = await service.updateEmailFlags("email-1", { isRead: true, isArchived: true });
      expect(result!.isRead).toBe(true);
      expect(result!.isArchived).toBe(true);
    });
  });

  // --- Delete email ---

  describe("deleteEmail", () => {
    test("deletes an email and returns true", async () => {
      emailRepo.findById.mockReturnValue(Promise.resolve(makeEmail()));
      emailRepo.delete.mockReturnValue(Promise.resolve(true));

      const result = await service.deleteEmail("email-1");
      expect(result).toBe(true);
      expect(emailRepo.delete).toHaveBeenCalledWith("email-1");
    });

    test("returns false when email does not exist", async () => {
      emailRepo.findById.mockReturnValue(Promise.resolve(null));

      const result = await service.deleteEmail("ghost");
      expect(result).toBe(false);
    });
  });

  // --- Get single email ---

  describe("getEmailById", () => {
    test("returns the email when found", async () => {
      const email = makeEmail();
      emailRepo.findById.mockReturnValue(Promise.resolve(email));

      const result = await service.getEmailById("email-1");
      expect(result).toEqual(email);
      expect(emailRepo.findById).toHaveBeenCalledWith("email-1");
    });

    test("returns null when not found", async () => {
      emailRepo.findById.mockReturnValue(Promise.resolve(null));

      const result = await service.getEmailById("ghost");
      expect(result).toBeNull();
    });
  });

  // --- Inbox queries ---

  describe("inbox queries", () => {
    test("fetches inbox with default limit", async () => {
      const emails = [makeEmail(), makeEmail({ id: "email-2" })];
      emailRepo.findAll.mockReturnValue(Promise.resolve(emails));

      const result = await service.getEmails({});
      expect(result).toHaveLength(2);
      expect(emailRepo.findAll).toHaveBeenCalledWith({});
    });

    test("fetches inbox filtered by folder", async () => {
      emailRepo.findAll.mockReturnValue(Promise.resolve([]));

      await service.getEmails({ folder: "Sent" });
      expect(emailRepo.findAll).toHaveBeenCalledWith({ folder: "Sent" });
    });

    test("fetches unread only", async () => {
      const unread = [makeEmail({ isRead: false })];
      emailRepo.findAll.mockReturnValue(Promise.resolve(unread));

      const result = await service.getEmails({ unread: true });
      expect(result).toHaveLength(1);
      expect(emailRepo.findAll).toHaveBeenCalledWith({ unread: true });
    });

    test("fetches inbox for a specific account", async () => {
      const emails = [makeEmail()];
      emailRepo.findByAccount.mockReturnValue(Promise.resolve(emails));

      const result = await service.getEmails({ accountId: "acc-1", folder: "INBOX", limit: 20, offset: 10 });
      expect(result).toEqual(emails);
      expect(emailRepo.findByAccount).toHaveBeenCalledWith("acc-1", { accountId: "acc-1", folder: "INBOX", limit: 20, offset: 10 });
    });

    test("fetches inbox with pagination", async () => {
      emailRepo.findAll.mockReturnValue(Promise.resolve([]));

      await service.getEmails({ limit: 10, offset: 50 });
      expect(emailRepo.findAll).toHaveBeenCalledWith({ limit: 10, offset: 50 });
    });
  });

  // --- Update account ---

  describe("updateAccount", () => {
    test("updates label", async () => {
      const updated = makeAccount({ label: "Travail" });
      accountRepo.update.mockReturnValue(Promise.resolve(updated));

      const result = await service.updateAccount("acc-1", { label: "Travail" });
      expect(result!.label).toBe("Travail");
      expect(accountRepo.update).toHaveBeenCalledWith("acc-1", { label: "Travail" });
    });

    test("disables sync", async () => {
      const updated = makeAccount({ syncEnabled: false });
      accountRepo.update.mockReturnValue(Promise.resolve(updated));

      const result = await service.updateAccount("acc-1", { syncEnabled: false });
      expect(result!.syncEnabled).toBe(false);
    });

    test("returns null for nonexistent account", async () => {
      accountRepo.update.mockReturnValue(Promise.resolve(null));

      const result = await service.updateAccount("ghost", { label: "X" });
      expect(result).toBeNull();
    });
  });

  describe("getUnreadCount", () => {
    test("returns unread count", async () => {
      emailRepo.countUnread.mockReturnValue(Promise.resolve(12));

      const result = await service.getUnreadCount();
      expect(result).toBe(12);
    });

    test("passes accountId filter", async () => {
      emailRepo.countUnread.mockReturnValue(Promise.resolve(5));

      const result = await service.getUnreadCount("acc-1");
      expect(result).toBe(5);
      expect(emailRepo.countUnread).toHaveBeenCalledWith("acc-1");
    });
  });

  // --- Sync ---

  describe("syncAccount", () => {
    test("fetches new emails from IMAP and stores them", async () => {
      const account = makeAccount();
      accountRepo.findById.mockReturnValue(Promise.resolve(account));
      accountRepo.getPassword.mockReturnValue(Promise.resolve("secret"));
      emailRepo.findMaxUid.mockReturnValue(Promise.resolve(50));

      const rawEmails: CreateEmailInput[] = [
        {
          accountId: "acc-1",
          messageId: "<new@gmail.com>",
          imapUid: 51,
          subject: "New email",
          fromAddress: "sender@example.com",
          fromName: "Sender",
          toAddresses: [],
          ccAddresses: [],
          bodyText: "Content",
          bodyHtml: null,
          hasAttachments: false,
          attachmentNames: [],
          isRead: false,
          folder: "INBOX",
          sentAt: new Date(),
        },
      ];
      imapConnector.fetchNewEmails.mockReturnValue(Promise.resolve(rawEmails));
      emailRepo.bulkCreate.mockReturnValue(Promise.resolve(1));

      const result = await service.syncAccount("acc-1");

      expect(result).toEqual({ newEmails: 1 });
      expect(imapConnector.fetchNewEmails).toHaveBeenCalledWith(account, "secret", "INBOX", 50);
      expect(emailRepo.bulkCreate).toHaveBeenCalledWith(rawEmails);
      expect(accountRepo.updateLastSyncedAt).toHaveBeenCalledTimes(1);
    });

    test("throws when account not found", async () => {
      accountRepo.findById.mockReturnValue(Promise.resolve(null));

      await expect(service.syncAccount("nonexistent")).rejects.toThrow("Account not found");
    });

    test("throws when password not found", async () => {
      accountRepo.findById.mockReturnValue(Promise.resolve(makeAccount()));
      accountRepo.getPassword.mockReturnValue(Promise.resolve(null));

      await expect(service.syncAccount("acc-1")).rejects.toThrow("Account password not found");
    });

    test("passes undefined sinceUid when no existing emails", async () => {
      accountRepo.findById.mockReturnValue(Promise.resolve(makeAccount()));
      accountRepo.getPassword.mockReturnValue(Promise.resolve("secret"));
      emailRepo.findMaxUid.mockReturnValue(Promise.resolve(null));
      imapConnector.fetchNewEmails.mockReturnValue(Promise.resolve([]));
      emailRepo.bulkCreate.mockReturnValue(Promise.resolve(0));

      await service.syncAccount("acc-1");

      expect(imapConnector.fetchNewEmails).toHaveBeenCalledWith(
        expect.anything(),
        "secret",
        "INBOX",
        undefined,
      );
    });
  });

  // --- Send email ---

  describe("sendEmail", () => {
    test("sends email via SMTP and saves to DB", async () => {
      const account = makeAccount();
      accountRepo.findById.mockReturnValue(Promise.resolve(account));
      accountRepo.getPassword.mockReturnValue(Promise.resolve("secret"));
      smtpConnector.sendEmail.mockReturnValue(Promise.resolve({ messageId: "<sent@test.com>" }));
      const savedEmail = makeEmail({ folder: "Sent", subject: "Hello" });
      emailRepo.create.mockReturnValue(Promise.resolve(savedEmail));

      const result = await service.sendEmail("acc-1", {
        to: ["alice@example.com"],
        subject: "Hello",
        bodyText: "Hi Alice",
      });

      expect(result).toEqual(savedEmail);
      expect(smtpConnector.sendEmail).toHaveBeenCalledWith(account, "secret", {
        to: ["alice@example.com"],
        subject: "Hello",
        bodyText: "Hi Alice",
      });
      expect(emailRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        accountId: "acc-1",
        folder: "Sent",
        subject: "Hello",
        fromAddress: "john@gmail.com",
      }));
    });

    test("throws when account not found", async () => {
      accountRepo.findById.mockReturnValue(Promise.resolve(null));
      await expect(service.sendEmail("ghost", { to: ["a@b.com"], subject: "X", bodyText: "Y" })).rejects.toThrow("Account not found");
    });

    test("throws when password not found", async () => {
      accountRepo.findById.mockReturnValue(Promise.resolve(makeAccount()));
      accountRepo.getPassword.mockReturnValue(Promise.resolve(null));
      await expect(service.sendEmail("acc-1", { to: ["a@b.com"], subject: "X", bodyText: "Y" })).rejects.toThrow("Account password not found");
    });

    test("sends with cc recipients", async () => {
      accountRepo.findById.mockReturnValue(Promise.resolve(makeAccount()));
      accountRepo.getPassword.mockReturnValue(Promise.resolve("secret"));
      smtpConnector.sendEmail.mockReturnValue(Promise.resolve({ messageId: "<sent2@test.com>" }));
      emailRepo.create.mockReturnValue(Promise.resolve(makeEmail()));

      await service.sendEmail("acc-1", {
        to: ["alice@example.com"],
        cc: ["bob@example.com"],
        subject: "Hello",
        bodyText: "Hi",
      });

      expect(smtpConnector.sendEmail).toHaveBeenCalledWith(
        expect.anything(),
        "secret",
        expect.objectContaining({ cc: ["bob@example.com"] }),
      );
      expect(emailRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        ccAddresses: [{ name: null, address: "bob@example.com" }],
      }));
    });
  });

  // Extended tests in unit/email.service.extended.test.ts
});
