import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import { createEmailRoutes } from "../../presentation/routes/email.routes";
import type { EmailService } from "../../application/email/email.service";
import type { Email } from "../../domain/email/email.entity";

function makeEmail(overrides: Partial<Email> = {}): Email {
  return { id: "email-1", accountId: "acc-1", messageId: "<msg@test.com>", imapUid: 100, subject: "Hello", fromAddress: "alice@test.com", fromName: "Alice", toAddresses: [], ccAddresses: [], bodyText: "Hi Bob", bodyHtml: "<p>Hi Bob</p>", hasAttachments: false, attachmentNames: [], isRead: false, isStarred: false, isArchived: false, folder: "INBOX", summary: null, classification: null, sentAt: new Date("2026-03-15T10:00:00Z"), createdAt: new Date("2026-03-15T10:01:00Z"), ...overrides };
}

function createMockService() {
  return {
    getEmails: mock(() => Promise.resolve([])),
    getEmailById: mock(() => Promise.resolve(null)),
    updateEmailFlags: mock(() => Promise.resolve(null)),
    deleteEmail: mock(() => Promise.resolve(false)),
    getUnreadCount: mock(() => Promise.resolve(0)),
    updateSummary: mock(() => Promise.resolve(null)),
    getDigest: mock(() => Promise.resolve({ totalUnread: 0, period: { from: "", to: "" }, bySender: [] })),
  };
}

function createMockLlm() {
  return {
    summarize: mock(() => Promise.resolve("LLM summary")),
    classify: mock(() => Promise.resolve("newsletter")),
  };
}

describe("Email Routes — Summarize & Classify", () => {
  let app: Hono;
  let svc: ReturnType<typeof createMockService>;
  let llm: ReturnType<typeof createMockLlm>;

  beforeEach(() => {
    svc = createMockService();
    llm = createMockLlm();
    app = new Hono();
    app.route("/api/emails", createEmailRoutes(svc as unknown as EmailService, llm as any));
  });

  describe("POST /api/emails/:id/summarize", () => {
    test("returns cached summary when already set", async () => {
      svc.getEmailById.mockReturnValue(Promise.resolve(makeEmail({ summary: "Cached", classification: "newsletter" })));
      const res = await app.request("/api/emails/email-1/summarize", { method: "POST" });
      const json = await res.json() as any;
      expect(res.status).toBe(200);
      expect(json.data.summary).toBe("Cached");
      expect(json.data.cached).toBe(true);
      expect(llm.summarize).not.toHaveBeenCalled();
    });

    test("generates and caches when no summary", async () => {
      svc.getEmailById.mockReturnValue(Promise.resolve(makeEmail()));
      llm.summarize.mockReturnValue(Promise.resolve("Generated"));
      llm.classify.mockReturnValue(Promise.resolve("action_requise"));
      svc.updateSummary.mockReturnValue(Promise.resolve(makeEmail({ summary: "Generated" })));
      const res = await app.request("/api/emails/email-1/summarize", { method: "POST" });
      const json = await res.json() as any;
      expect(json.data.summary).toBe("Generated");
      expect(json.data.cached).toBe(false);
      expect(svc.updateSummary).toHaveBeenCalled();
    });

    test("returns 404 when email not found", async () => {
      const res = await app.request("/api/emails/ghost/summarize", { method: "POST" });
      expect(res.status).toBe(404);
    });

    test("returns 400 when email has no content", async () => {
      svc.getEmailById.mockReturnValue(Promise.resolve(makeEmail({ bodyText: null, bodyHtml: null })));
      const res = await app.request("/api/emails/email-1/summarize", { method: "POST" });
      expect(res.status).toBe(400);
    });

    test("returns 400 when no LLM configured", async () => {
      const appNoLlm = new Hono();
      appNoLlm.route("/api/emails", createEmailRoutes(svc as unknown as EmailService));
      const res = await appNoLlm.request("/api/emails/email-1/summarize", { method: "POST" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/emails/:id/classify", () => {
    test("returns cached classification", async () => {
      svc.getEmailById.mockReturnValue(Promise.resolve(makeEmail({ classification: "facture" })));
      const res = await app.request("/api/emails/email-1/classify", { method: "POST" });
      const json = await res.json() as any;
      expect(json.data.classification).toBe("facture");
      expect(json.data.cached).toBe(true);
    });

    test("generates when no classification", async () => {
      svc.getEmailById.mockReturnValue(Promise.resolve(makeEmail()));
      llm.classify.mockReturnValue(Promise.resolve("personnel"));
      svc.updateSummary.mockReturnValue(Promise.resolve(makeEmail({ classification: "personnel" })));
      const res = await app.request("/api/emails/email-1/classify", { method: "POST" });
      const json = await res.json() as any;
      expect(json.data.classification).toBe("personnel");
      expect(json.data.cached).toBe(false);
    });

    test("returns 404 when email not found", async () => {
      const res = await app.request("/api/emails/ghost/classify", { method: "POST" });
      expect(res.status).toBe(404);
    });

    test("returns 400 when no LLM", async () => {
      const appNoLlm = new Hono();
      appNoLlm.route("/api/emails", createEmailRoutes(svc as unknown as EmailService));
      const res = await appNoLlm.request("/api/emails/email-1/classify", { method: "POST" });
      expect(res.status).toBe(400);
    });
  });
});
