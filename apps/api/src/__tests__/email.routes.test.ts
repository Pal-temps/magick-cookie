import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import { createEmailRoutes, createEmailAccountRoutes } from "../presentation/routes/email.routes";
import type { EmailService } from "../application/email/email.service";
import type { Email, EmailAccount } from "../domain/email/email.entity";

// --- Factories ---

function makeEmail(overrides: Partial<Email> = {}): Email {
  return {
    id: "email-1",
    accountId: "acc-1",
    messageId: "<msg-1@test.com>",
    imapUid: 100,
    subject: "Hello",
    fromAddress: "alice@test.com",
    fromName: "Alice",
    toAddresses: [{ name: "Bob", address: "bob@test.com" }],
    ccAddresses: [],
    bodyText: "Hi Bob",
    bodyHtml: "<p>Hi Bob</p>",
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

function makeAccount(overrides: Partial<EmailAccount> = {}): EmailAccount {
  return {
    id: "acc-1",
    label: "Perso",
    email: "bob@test.com",
    imapHost: "imap.test.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.test.com",
    smtpPort: 587,
    smtpSecure: false,
    username: "bob@test.com",
    lastSyncedAt: null,
    syncEnabled: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// --- Mock service ---

function createMockService() {
  return {
    getAccounts: mock(() => Promise.resolve([])),
    getActiveAccounts: mock(() => Promise.resolve([])),
    getAccountById: mock(() => Promise.resolve(null)),
    createAccount: mock(() => Promise.resolve(makeAccount())),
    updateAccount: mock(() => Promise.resolve(null)),
    deleteAccount: mock(() => Promise.resolve(false)),
    testConnection: mock(() => Promise.resolve(true)),
    getEmails: mock(() => Promise.resolve([])),
    getEmailById: mock(() => Promise.resolve(null)),
    updateEmailFlags: mock(() => Promise.resolve(null)),
    deleteEmail: mock(() => Promise.resolve(false)),
    getUnreadCount: mock(() => Promise.resolve(0)),
    syncAccount: mock(() => Promise.resolve({ newEmails: 0 })),
    syncAll: mock(() => Promise.resolve({ total: 0, errors: [] })),
  };
}

// --- Email routes tests ---

describe("Email Routes", () => {
  let app: Hono;
  let mockService: ReturnType<typeof createMockService>;

  beforeEach(() => {
    mockService = createMockService();
    app = new Hono();
    app.route("/api/emails", createEmailRoutes(mockService as unknown as EmailService));
  });

  describe("GET /api/emails", () => {
    test("returns email list", async () => {
      const emails = [makeEmail(), makeEmail({ id: "email-2", subject: "World" })];
      mockService.getEmails.mockReturnValue(Promise.resolve(emails));

      const res = await app.request("/api/emails?folder=INBOX&limit=50&offset=0");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(2);
      expect(json.data[0].subject).toBe("Hello");
    });

    test("passes query params to service", async () => {
      mockService.getEmails.mockReturnValue(Promise.resolve([]));

      await app.request("/api/emails?folder=Sent&unread=true&limit=10&offset=5");
      expect(mockService.getEmails).toHaveBeenCalledWith({
        folder: "Sent",
        unread: true,
        limit: 10,
        offset: 5,
      });
    });

    test("returns empty list for empty inbox", async () => {
      mockService.getEmails.mockReturnValue(Promise.resolve([]));

      const res = await app.request("/api/emails");
      const json = await res.json();
      expect(json.data).toHaveLength(0);
    });
  });

  describe("GET /api/emails/unread-count", () => {
    test("returns unread count", async () => {
      mockService.getUnreadCount.mockReturnValue(Promise.resolve(7));

      const res = await app.request("/api/emails/unread-count");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.count).toBe(7);
    });
  });

  describe("GET /api/emails/:id", () => {
    test("returns email when found", async () => {
      mockService.getEmailById.mockReturnValue(Promise.resolve(makeEmail()));

      const res = await app.request("/api/emails/email-1");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.subject).toBe("Hello");
    });

    test("returns 404 when not found", async () => {
      mockService.getEmailById.mockReturnValue(Promise.resolve(null));

      const res = await app.request("/api/emails/ghost");
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/emails/:id (mark read)", () => {
    test("marks email as read", async () => {
      const updated = makeEmail({ isRead: true });
      mockService.updateEmailFlags.mockReturnValue(Promise.resolve(updated));

      const res = await app.request("/api/emails/email-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.isRead).toBe(true);
      expect(mockService.updateEmailFlags).toHaveBeenCalledWith("email-1", { isRead: true });
    });

    test("marks email as unread", async () => {
      const updated = makeEmail({ isRead: false });
      mockService.updateEmailFlags.mockReturnValue(Promise.resolve(updated));

      const res = await app.request("/api/emails/email-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: false }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.isRead).toBe(false);
    });
  });

  describe("PATCH /api/emails/:id (star)", () => {
    test("stars an email", async () => {
      const updated = makeEmail({ isStarred: true });
      mockService.updateEmailFlags.mockReturnValue(Promise.resolve(updated));

      const res = await app.request("/api/emails/email-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred: true }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.isStarred).toBe(true);
    });

    test("unstars an email", async () => {
      const updated = makeEmail({ isStarred: false });
      mockService.updateEmailFlags.mockReturnValue(Promise.resolve(updated));

      const res = await app.request("/api/emails/email-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred: false }),
      });

      const json = await res.json();
      expect(json.data.isStarred).toBe(false);
    });
  });

  describe("PATCH /api/emails/:id (archive)", () => {
    test("archives an email", async () => {
      const updated = makeEmail({ isArchived: true });
      mockService.updateEmailFlags.mockReturnValue(Promise.resolve(updated));

      const res = await app.request("/api/emails/email-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.isArchived).toBe(true);
      expect(mockService.updateEmailFlags).toHaveBeenCalledWith("email-1", { isArchived: true });
    });

    test("unarchives an email", async () => {
      const updated = makeEmail({ isArchived: false });
      mockService.updateEmailFlags.mockReturnValue(Promise.resolve(updated));

      const res = await app.request("/api/emails/email-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      });

      const json = await res.json();
      expect(json.data.isArchived).toBe(false);
    });

    test("returns 404 when archiving nonexistent email", async () => {
      mockService.updateEmailFlags.mockReturnValue(Promise.resolve(null));

      const res = await app.request("/api/emails/ghost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/emails/:id (combined flags)", () => {
    test("read + star + archive in one call", async () => {
      const updated = makeEmail({ isRead: true, isStarred: true, isArchived: true });
      mockService.updateEmailFlags.mockReturnValue(Promise.resolve(updated));

      const res = await app.request("/api/emails/email-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true, isStarred: true, isArchived: true }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.isRead).toBe(true);
      expect(json.data.isStarred).toBe(true);
      expect(json.data.isArchived).toBe(true);
    });
  });

  describe("DELETE /api/emails/:id", () => {
    test("deletes an email", async () => {
      mockService.deleteEmail.mockReturnValue(Promise.resolve(true));

      const res = await app.request("/api/emails/email-1", { method: "DELETE" });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.ok).toBe(true);
    });

    test("returns 404 when deleting nonexistent email", async () => {
      mockService.deleteEmail.mockReturnValue(Promise.resolve(false));

      const res = await app.request("/api/emails/ghost", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });
});

// --- Email account routes tests ---

describe("Email Account Routes", () => {
  let app: Hono;
  let mockService: ReturnType<typeof createMockService>;

  beforeEach(() => {
    mockService = createMockService();
    app = new Hono();
    app.route("/api/email-accounts", createEmailAccountRoutes(mockService as unknown as EmailService));
  });

  describe("GET /api/email-accounts", () => {
    test("returns all accounts", async () => {
      const accounts = [makeAccount(), makeAccount({ id: "acc-2", label: "Pro" })];
      mockService.getAccounts.mockReturnValue(Promise.resolve(accounts));

      const res = await app.request("/api/email-accounts");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(2);
    });
  });

  describe("POST /api/email-accounts", () => {
    test("creates a new account", async () => {
      const created = makeAccount();
      mockService.createAccount.mockReturnValue(Promise.resolve(created));

      const res = await app.request("/api/email-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Perso",
          email: "bob@test.com",
          imapHost: "imap.test.com",
          imapPort: 993,
          imapSecure: true,
          smtpHost: "smtp.test.com",
          smtpPort: 587,
          smtpSecure: false,
          username: "bob@test.com",
          password: "secret",
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.label).toBe("Perso");
    });
  });

  describe("DELETE /api/email-accounts/:id", () => {
    test("deletes an account", async () => {
      mockService.deleteAccount.mockReturnValue(Promise.resolve(true));

      const res = await app.request("/api/email-accounts/acc-1", { method: "DELETE" });
      expect(res.status).toBe(200);
    });

    test("returns 404 for nonexistent account", async () => {
      mockService.deleteAccount.mockReturnValue(Promise.resolve(false));

      const res = await app.request("/api/email-accounts/ghost", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/email-accounts/:id/sync", () => {
    test("triggers sync and returns result", async () => {
      mockService.syncAccount.mockReturnValue(Promise.resolve({ newEmails: 5 }));

      const res = await app.request("/api/email-accounts/acc-1/sync", { method: "POST" });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.newEmails).toBe(5);
    });
  });

  describe("POST /api/email-accounts/test-connection", () => {
    test("returns success when connection works", async () => {
      mockService.testConnection.mockReturnValue(Promise.resolve(true));

      const res = await app.request("/api/email-accounts/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Test",
          email: "test@test.com",
          imapHost: "imap.test.com",
          imapPort: 993,
          imapSecure: true,
          smtpHost: "smtp.test.com",
          smtpPort: 587,
          smtpSecure: false,
          username: "test@test.com",
          password: "secret",
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.success).toBe(true);
    });

    test("returns failure when connection fails", async () => {
      mockService.testConnection.mockReturnValue(Promise.resolve(false));

      const res = await app.request("/api/email-accounts/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Test",
          email: "test@test.com",
          imapHost: "imap.test.com",
          imapPort: 993,
          imapSecure: true,
          smtpHost: "smtp.test.com",
          smtpPort: 587,
          smtpSecure: false,
          username: "test@test.com",
          password: "wrong",
        }),
      });

      const json = await res.json();
      expect(json.data.success).toBe(false);
    });
  });
});
