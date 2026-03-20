import { describe, test, expect, beforeEach, mock } from "bun:test";
import { EmailService } from "../../application/email/email.service";
import type { EmailAccountRepository, EmailRepository } from "../../domain/email/email.repository";
import type { EmailAccount } from "../../domain/email/email.entity";
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

// --- Mocks ---

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

describe("EmailService — syncAccount (syncFlags + reconcileMissing)", () => {
  let service: EmailService;
  let accountRepo: ReturnType<typeof createMockAccountRepo>;
  let emailRepo: ReturnType<typeof createMockEmailRepo>;
  let imapConnector: ReturnType<typeof createMockImapConnector>;
  let smtpConnector: ReturnType<typeof createMockSmtpConnector>;

  const account = makeAccount();

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

    // Default: account exists with password
    accountRepo.findById.mockReturnValue(Promise.resolve(account));
    accountRepo.getPassword.mockReturnValue(Promise.resolve("secret"));
  });

  // =========================================================================
  // syncFlags (tested indirectly via syncAccount)
  // =========================================================================

  describe("syncFlags", () => {
    test("updates DB when IMAP flags differ from DB", async () => {
      // DB has email uid=100 unread+unstarred
      emailRepo.findFlagsByAccount.mockReturnValue(Promise.resolve([
        { id: "e1", imapUid: 100, isRead: false, isStarred: false },
      ]));

      // IMAP says uid=100 is read+starred
      const imapFlags = new Map([[100, { seen: true, flagged: true }]]);
      imapConnector.fetchFlags.mockReturnValue(Promise.resolve(imapFlags));
      emailRepo.bulkUpdateFlags.mockReturnValue(Promise.resolve(1));

      await service.syncAccount("acc-1");

      expect(emailRepo.findFlagsByAccount).toHaveBeenCalledWith("acc-1", "INBOX", 200);
      expect(imapConnector.fetchFlags).toHaveBeenCalled();
      expect(emailRepo.bulkUpdateFlags).toHaveBeenCalledWith([
        { id: "e1", isRead: true, isStarred: true },
      ]);
    });

    test("skips update when flags already match", async () => {
      emailRepo.findFlagsByAccount.mockReturnValue(Promise.resolve([
        { id: "e1", imapUid: 100, isRead: true, isStarred: false },
      ]));

      const imapFlags = new Map([[100, { seen: true, flagged: false }]]);
      imapConnector.fetchFlags.mockReturnValue(Promise.resolve(imapFlags));

      await service.syncAccount("acc-1");

      expect(emailRepo.bulkUpdateFlags).not.toHaveBeenCalled();
    });

    test("skips when no emails have IMAP UIDs", async () => {
      emailRepo.findFlagsByAccount.mockReturnValue(Promise.resolve([
        { id: "e1", imapUid: null, isRead: false, isStarred: false },
      ]));

      await service.syncAccount("acc-1");

      expect(imapConnector.fetchFlags).not.toHaveBeenCalled();
      expect(emailRepo.bulkUpdateFlags).not.toHaveBeenCalled();
    });

    test("handles partial flag changes (only isRead differs)", async () => {
      emailRepo.findFlagsByAccount.mockReturnValue(Promise.resolve([
        { id: "e1", imapUid: 100, isRead: false, isStarred: true },
      ]));

      const imapFlags = new Map([[100, { seen: true, flagged: true }]]);
      imapConnector.fetchFlags.mockReturnValue(Promise.resolve(imapFlags));
      emailRepo.bulkUpdateFlags.mockReturnValue(Promise.resolve(1));

      await service.syncAccount("acc-1");

      expect(emailRepo.bulkUpdateFlags).toHaveBeenCalledWith([
        { id: "e1", isRead: true },
      ]);
    });

    test("handles partial flag changes (only isStarred differs)", async () => {
      emailRepo.findFlagsByAccount.mockReturnValue(Promise.resolve([
        { id: "e1", imapUid: 100, isRead: true, isStarred: false },
      ]));

      const imapFlags = new Map([[100, { seen: true, flagged: true }]]);
      imapConnector.fetchFlags.mockReturnValue(Promise.resolve(imapFlags));
      emailRepo.bulkUpdateFlags.mockReturnValue(Promise.resolve(1));

      await service.syncAccount("acc-1");

      expect(emailRepo.bulkUpdateFlags).toHaveBeenCalledWith([
        { id: "e1", isStarred: true },
      ]);
    });

    test("handles multiple emails with mixed flag states", async () => {
      emailRepo.findFlagsByAccount.mockReturnValue(Promise.resolve([
        { id: "e1", imapUid: 100, isRead: false, isStarred: false },
        { id: "e2", imapUid: 101, isRead: true, isStarred: true },
        { id: "e3", imapUid: 102, isRead: false, isStarred: true },
      ]));

      const imapFlags = new Map([
        [100, { seen: true, flagged: false }],   // isRead changed
        [101, { seen: true, flagged: true }],     // no change
        [102, { seen: true, flagged: false }],    // both changed
      ]);
      imapConnector.fetchFlags.mockReturnValue(Promise.resolve(imapFlags));
      emailRepo.bulkUpdateFlags.mockReturnValue(Promise.resolve(2));

      await service.syncAccount("acc-1");

      expect(emailRepo.bulkUpdateFlags).toHaveBeenCalledWith([
        { id: "e1", isRead: true },
        { id: "e3", isRead: true, isStarred: false },
      ]);
    });

    test("skips emails not found in IMAP flags response", async () => {
      emailRepo.findFlagsByAccount.mockReturnValue(Promise.resolve([
        { id: "e1", imapUid: 100, isRead: false, isStarred: false },
        { id: "e2", imapUid: 999, isRead: false, isStarred: false },
      ]));

      // Only uid 100 returned by IMAP
      const imapFlags = new Map([[100, { seen: true, flagged: false }]]);
      imapConnector.fetchFlags.mockReturnValue(Promise.resolve(imapFlags));
      emailRepo.bulkUpdateFlags.mockReturnValue(Promise.resolve(1));

      await service.syncAccount("acc-1");

      expect(emailRepo.bulkUpdateFlags).toHaveBeenCalledWith([
        { id: "e1", isRead: true },
      ]);
    });

    test("does not crash when fetchFlags throws", async () => {
      emailRepo.findFlagsByAccount.mockReturnValue(Promise.resolve([
        { id: "e1", imapUid: 100, isRead: false, isStarred: false },
      ]));
      imapConnector.fetchFlags.mockReturnValue(Promise.reject(new Error("IMAP timeout")));

      // Should not throw — syncFlags catches errors internally
      const result = await service.syncAccount("acc-1");
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // reconcileMissing (tested indirectly via syncAccount)
  // =========================================================================

  describe("reconcileMissing", () => {
    test("re-imports emails present on IMAP but missing from DB", async () => {
      // IMAP has UIDs [100, 101, 102], DB only has [100]
      imapConnector.listRecentUids.mockReturnValue(Promise.resolve([100, 101, 102]));
      emailRepo.findUidsByAccount.mockReturnValue(Promise.resolve([100]));
      imapConnector.fetchByUids.mockReturnValue(Promise.resolve([
        { accountId: "acc-1", messageId: "<m2>", imapUid: 101, subject: "Re-imported", fromAddress: "a@b.com", fromName: null, toAddresses: [], ccAddresses: [], bodyText: "hi", bodyHtml: null, hasAttachments: false, attachmentNames: [], isRead: false, folder: "INBOX", sentAt: new Date() },
      ]));
      // First call (fetchNewEmails bulkCreate) returns 0, second (reconcile) returns 2
      emailRepo.bulkCreate
        .mockReturnValueOnce(Promise.resolve(0))
        .mockReturnValueOnce(Promise.resolve(2));

      const result = await service.syncAccount("acc-1");

      expect(imapConnector.fetchByUids).toHaveBeenCalledWith(account, "secret", "INBOX", [101, 102]);
      expect(emailRepo.bulkCreate).toHaveBeenCalledTimes(2); // once for new emails, once for reconcile
      expect(result.newEmails).toBe(2); // 0 from fetch + 2 from reconcile
    });

    test("does nothing when IMAP has no recent UIDs", async () => {
      imapConnector.listRecentUids.mockReturnValue(Promise.resolve([]));

      await service.syncAccount("acc-1");

      expect(imapConnector.fetchByUids).not.toHaveBeenCalled();
    });

    test("does nothing when all IMAP UIDs exist in DB", async () => {
      imapConnector.listRecentUids.mockReturnValue(Promise.resolve([100, 101]));
      emailRepo.findUidsByAccount.mockReturnValue(Promise.resolve([100, 101]));

      await service.syncAccount("acc-1");

      expect(imapConnector.fetchByUids).not.toHaveBeenCalled();
    });

    test("caps fetch to 50 missing UIDs", async () => {
      const manyUids = Array.from({ length: 80 }, (_, i) => i + 1);
      imapConnector.listRecentUids.mockReturnValue(Promise.resolve(manyUids));
      emailRepo.findUidsByAccount.mockReturnValue(Promise.resolve([])); // none in DB
      imapConnector.fetchByUids.mockReturnValue(Promise.resolve([]));

      await service.syncAccount("acc-1");

      // Should fetch last 50 UIDs (31-80)
      const fetchCall = imapConnector.fetchByUids.mock.calls[0];
      expect(fetchCall[3]).toHaveLength(50);
      expect(fetchCall[3][0]).toBe(31); // slice(-50) on [1..80]
    });

    test("does not crash when listRecentUids throws", async () => {
      imapConnector.listRecentUids.mockReturnValue(Promise.reject(new Error("Network error")));

      // Should not throw — reconcileMissing catches errors
      const result = await service.syncAccount("acc-1");
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // sendEmail
  // =========================================================================

  describe("sendEmail", () => {
    test("sends via SMTP and saves Sent copy", async () => {
      const savedEmail = {
        id: "sent-1",
        accountId: "acc-1",
        messageId: "<sent@test.com>",
        subject: "Hello",
        folder: "Sent",
      };
      emailRepo.create.mockReturnValue(Promise.resolve(savedEmail));

      const result = await service.sendEmail("acc-1", {
        to: ["bob@example.com"],
        subject: "Hello",
        bodyText: "Hi Bob",
      });

      expect(smtpConnector.sendEmail).toHaveBeenCalledWith(account, "secret", {
        to: ["bob@example.com"],
        subject: "Hello",
        bodyText: "Hi Bob",
      });
      expect(emailRepo.create).toHaveBeenCalled();
      const createArg = emailRepo.create.mock.calls[0][0];
      expect(createArg.folder).toBe("Sent");
      expect(createArg.isRead).toBe(true);
      expect(createArg.fromAddress).toBe("john@gmail.com");
      expect(result).toEqual(savedEmail);
    });

    test("throws when account not found", async () => {
      accountRepo.findById.mockReturnValue(Promise.resolve(null));

      await expect(service.sendEmail("ghost", {
        to: ["a@b.com"],
        subject: "Hi",
        bodyText: "test",
      })).rejects.toThrow("Account not found");
    });

    test("throws when password not found", async () => {
      accountRepo.getPassword.mockReturnValue(Promise.resolve(null));

      await expect(service.sendEmail("acc-1", {
        to: ["a@b.com"],
        subject: "Hi",
        bodyText: "test",
      })).rejects.toThrow("Account password not found");
    });

    test("sends with cc recipients", async () => {
      emailRepo.create.mockReturnValue(Promise.resolve({ id: "sent-1" }));

      await service.sendEmail("acc-1", {
        to: ["bob@example.com"],
        cc: ["carol@example.com"],
        subject: "Team update",
        bodyText: "FYI",
      });

      const smtpCall = smtpConnector.sendEmail.mock.calls[0][2];
      expect(smtpCall.cc).toEqual(["carol@example.com"]);

      const createArg = emailRepo.create.mock.calls[0][0];
      expect(createArg.ccAddresses).toEqual([{ name: null, address: "carol@example.com" }]);
    });
  });

  // =========================================================================
  // syncAccount (full flow)
  // =========================================================================

  describe("syncAccount — full flow", () => {
    test("throws when account not found", async () => {
      accountRepo.findById.mockReturnValue(Promise.resolve(null));
      await expect(service.syncAccount("ghost")).rejects.toThrow("Account not found");
    });

    test("throws when password not found", async () => {
      accountRepo.getPassword.mockReturnValue(Promise.resolve(null));
      await expect(service.syncAccount("acc-1")).rejects.toThrow("Account password not found");
    });

    test("runs full pipeline: fetch -> reconcile -> syncFlags -> updateLastSyncedAt", async () => {
      emailRepo.findMaxUid.mockReturnValue(Promise.resolve(99));
      imapConnector.fetchNewEmails.mockReturnValue(Promise.resolve([]));
      emailRepo.bulkCreate.mockReturnValue(Promise.resolve(0));
      imapConnector.listRecentUids.mockReturnValue(Promise.resolve([]));
      emailRepo.findFlagsByAccount.mockReturnValue(Promise.resolve([]));

      const result = await service.syncAccount("acc-1");

      expect(imapConnector.fetchNewEmails).toHaveBeenCalledWith(account, "secret", "INBOX", 99);
      expect(imapConnector.listRecentUids).toHaveBeenCalled();
      expect(emailRepo.findFlagsByAccount).toHaveBeenCalled();
      expect(accountRepo.updateLastSyncedAt).toHaveBeenCalled();
      expect(result).toEqual({ newEmails: 0 });
    });

    test("counts new emails from both fetch and reconcile", async () => {
      // 3 new from IMAP fetch
      imapConnector.fetchNewEmails.mockReturnValue(Promise.resolve([{}, {}, {}] as any));
      emailRepo.bulkCreate
        .mockReturnValueOnce(Promise.resolve(3))  // from fetch
        .mockReturnValueOnce(Promise.resolve(2)); // from reconcile

      // 2 from reconcile
      imapConnector.listRecentUids.mockReturnValue(Promise.resolve([200, 201]));
      emailRepo.findUidsByAccount.mockReturnValue(Promise.resolve([]));
      imapConnector.fetchByUids.mockReturnValue(Promise.resolve([{}, {}] as any));

      emailRepo.findFlagsByAccount.mockReturnValue(Promise.resolve([]));

      const result = await service.syncAccount("acc-1");
      expect(result.newEmails).toBe(5);
    });
  });
});
