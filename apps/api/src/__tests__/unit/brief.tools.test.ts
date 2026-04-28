import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
  createBriefTools,
  createEmailTools,
  createProjectTools,
} from "../../application/agent/tools/brief.tools";
import type { BriefService } from "../../application/brief/brief.service";
import type { EmailService } from "../../application/email/email.service";
import type { LlmService } from "../../application/llm/llm.service";
import type { ProjectService } from "../../application/project/project.service";
import type { Email } from "../../domain/email/email.entity";
import type { AgentTool } from "../../application/agent/tool-registry";

const makeEmail = (overrides: Partial<Email> = {}): Email => ({
  id: "e1",
  accountId: "acc1",
  messageId: "<x>",
  imapUid: null,
  subject: "Subject",
  fromAddress: "a@b.com",
  fromName: "Alice",
  toAddresses: [],
  ccAddresses: [],
  bodyText: "Body text content",
  bodyHtml: null,
  hasAttachments: false,
  attachmentNames: [],
  isRead: false,
  isStarred: false,
  isArchived: false,
  folder: "INBOX",
  summary: null,
  classification: null,
  sentAt: new Date(),
  createdAt: new Date(),
  ...overrides,
});

describe("brief.tools (split factories)", () => {
  describe("createBriefTools", () => {
    let svc: { generate: ReturnType<typeof mock> };
    let tool: AgentTool;

    beforeEach(() => {
      svc = { generate: mock(() => Promise.resolve({ summary: "ok" } as never)) };
      const tools = createBriefTools(svc as unknown as BriefService);
      expect(tools).toHaveLength(1);
      tool = tools[0];
    });

    it("generate_brief delegates with today when date omitted", async () => {
      await tool.execute({});
      const arg = svc.generate.mock.calls[0][0] as Date;
      expect(arg).toBeInstanceOf(Date);
    });

    it("generate_brief converts a YYYY-MM-DD string to Date", async () => {
      await tool.execute({ date: "2026-04-28" });
      const arg = svc.generate.mock.calls[0][0] as Date;
      expect(arg.toISOString().slice(0, 10)).toBe("2026-04-28");
    });

    it("generate_brief rejects bad date format", async () => {
      const result = (await tool.execute({ date: "Apr 28" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.generate).not.toHaveBeenCalled();
    });
  });

  describe("createEmailTools", () => {
    let emailSvc: { [K in keyof EmailService]: ReturnType<typeof mock> };
    let llmSvc: { classify: ReturnType<typeof mock> };
    let countTool: AgentTool;
    let syncTool: AgentTool;
    let classifyTool: AgentTool;
    let classifyToolNoLlm: AgentTool;

    beforeEach(() => {
      emailSvc = {
        getUnreadCount: mock(() => Promise.resolve(7)),
        syncAll: mock(() => Promise.resolve({ total: 0, errors: [] })),
        getEmailById: mock(() => Promise.resolve(null)),
        updateSummary: mock(() => Promise.resolve({} as never)),
      } as unknown as { [K in keyof EmailService]: ReturnType<typeof mock> };
      llmSvc = { classify: mock(() => Promise.resolve("newsletter")) };

      const tools = createEmailTools(emailSvc as unknown as EmailService, llmSvc as unknown as LlmService);
      countTool = tools.find((t) => t.name === "get_unread_email_count")!;
      syncTool = tools.find((t) => t.name === "sync_emails")!;
      classifyTool = tools.find((t) => t.name === "classify_email")!;

      // Build a second instance without LLM to test the "LLM non configure" branch.
      classifyToolNoLlm = createEmailTools(emailSvc as unknown as EmailService, undefined)
        .find((t) => t.name === "classify_email")!;
    });

    it("get_unread_email_count returns the count from the service", async () => {
      const result = (await countTool.execute({})) as { unreadCount: number };
      expect(result.unreadCount).toBe(7);
    });

    it("sync_emails returns success: true", async () => {
      const result = (await syncTool.execute({})) as { success: boolean };
      expect(result.success).toBe(true);
      expect(emailSvc.syncAll).toHaveBeenCalledTimes(1);
    });

    it("classify_email returns cached classification when present (no LLM call)", async () => {
      emailSvc.getEmailById.mockReturnValue(Promise.resolve(makeEmail({ classification: "facture" })));
      const result = (await classifyTool.execute({ emailId: "e1" })) as { classification: string; cached: boolean };
      expect(result.classification).toBe("facture");
      expect(result.cached).toBe(true);
      expect(llmSvc.classify).not.toHaveBeenCalled();
    });

    it("classify_email runs LLM + persists when no cached classification", async () => {
      emailSvc.getEmailById.mockReturnValue(Promise.resolve(makeEmail({ bodyText: "spam content", classification: null })));
      llmSvc.classify.mockReturnValue(Promise.resolve("newsletter"));

      const result = (await classifyTool.execute({ emailId: "e1" })) as { classification: string; cached: boolean };
      expect(result.classification).toBe("newsletter");
      expect(result.cached).toBe(false);
      expect(emailSvc.updateSummary).toHaveBeenCalled();
    });

    it("classify_email errors when email is not found", async () => {
      emailSvc.getEmailById.mockReturnValue(Promise.resolve(null));
      const result = (await classifyTool.execute({ emailId: "ghost" })) as { error?: string };
      expect(result.error).toContain("non trouve");
    });

    it("classify_email strips HTML if bodyText is empty", async () => {
      emailSvc.getEmailById.mockReturnValue(Promise.resolve(makeEmail({ bodyText: "", bodyHtml: "<p>Hello <b>world</b></p>" })));
      await classifyTool.execute({ emailId: "e1" });
      const [text] = llmSvc.classify.mock.calls[0];
      expect(text as string).toContain("Hello world");
      expect(text as string).not.toContain("<");
    });

    it("classify_email errors when email has no content at all", async () => {
      emailSvc.getEmailById.mockReturnValue(Promise.resolve(makeEmail({ bodyText: "", bodyHtml: null })));
      const result = (await classifyTool.execute({ emailId: "e1" })) as { error?: string };
      expect(result.error).toContain("Email sans contenu");
    });

    it("classify_email errors when LLM is not wired", async () => {
      const result = (await classifyToolNoLlm.execute({ emailId: "e1" })) as { error?: string };
      expect(result.error).toContain("LLM non configure");
    });
  });

  describe("createProjectTools", () => {
    let svc: { [K in keyof ProjectService]: ReturnType<typeof mock> };
    let listTool: AgentTool;
    let createTool: AgentTool;

    beforeEach(() => {
      svc = {
        getAll: mock(() => Promise.resolve([])),
        create: mock(() => Promise.resolve({ id: "p1" } as never)),
      } as unknown as { [K in keyof ProjectService]: ReturnType<typeof mock> };
      const tools = createProjectTools(svc as unknown as ProjectService);
      listTool = tools.find((t) => t.name === "list_projects")!;
      createTool = tools.find((t) => t.name === "create_project")!;
    });

    it("list_projects delegates", async () => {
      await listTool.execute({});
      expect(svc.getAll).toHaveBeenCalledTimes(1);
    });

    it("create_project forwards name and turns missing color into undefined", async () => {
      await createTool.execute({ name: "X" });
      const arg = svc.create.mock.calls[0][0] as { name: string; color: string | undefined };
      expect(arg.name).toBe("X");
      expect(arg.color).toBeUndefined();
    });

    it("create_project forwards explicit color", async () => {
      await createTool.execute({ name: "X", color: "#abcdef" });
      const arg = svc.create.mock.calls[0][0] as { color: string | undefined };
      expect(arg.color).toBe("#abcdef");
    });
  });
});
