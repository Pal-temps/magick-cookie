import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createEmailActionTools } from "../../application/agent/tools/email-actions.tools";
import type { EmailService } from "../../application/email/email.service";
import type { Email } from "../../domain/email/email.entity";
import type { AgentTool } from "../../application/agent/tool-registry";

const makeEmail = (overrides: Partial<Email> = {}): Email => ({
  id: "e1",
  accountId: "acc-1",
  messageId: "<msg>",
  imapUid: 42,
  subject: "Hello",
  fromAddress: "alice@example.com",
  fromName: "Alice",
  toAddresses: [],
  ccAddresses: [{ name: null, address: "carol@example.com" }],
  bodyText: "body",
  bodyHtml: null,
  hasAttachments: false,
  attachmentNames: [],
  isRead: false,
  isStarred: false,
  isArchived: false,
  folder: "INBOX",
  summary: null,
  classification: null,
  sentAt: new Date("2026-04-28T10:00:00Z"),
  createdAt: new Date("2026-04-28T10:00:00Z"),
  ...overrides,
});

describe("email-actions.tools", () => {
  let svc: { [K in keyof EmailService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let compose: AgentTool;
  let send: AgentTool;
  let reply: AgentTool;
  let markRead: AgentTool;
  let star: AgentTool;
  let move: AgentTool;
  let del: AgentTool;
  let bulkDel: AgentTool;

  beforeEach(() => {
    svc = {
      sendEmail: mock(() => Promise.resolve(makeEmail({ id: "sent-1" }))),
      getEmailById: mock(() => Promise.resolve(makeEmail())),
      updateEmailFlags: mock(() => Promise.resolve(makeEmail())),
      moveEmail: mock(() => Promise.resolve(makeEmail({ folder: "Archive" }))),
      deleteEmail: mock(() => Promise.resolve(true)),
      bulkDeleteEmails: mock(() => Promise.resolve(0)),
    } as unknown as { [K in keyof EmailService]: ReturnType<typeof mock> };

    tools = createEmailActionTools(svc as unknown as EmailService);
    compose = tools.find((t) => t.name === "email_compose")!;
    send = tools.find((t) => t.name === "email_send")!;
    reply = tools.find((t) => t.name === "email_reply")!;
    markRead = tools.find((t) => t.name === "email_mark_read")!;
    star = tools.find((t) => t.name === "email_star")!;
    move = tools.find((t) => t.name === "email_move")!;
    del = tools.find((t) => t.name === "email_delete")!;
    bulkDel = tools.find((t) => t.name === "email_bulk_delete")!;
  });

  it("registers the 8 P4.2 action tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "email_bulk_delete",
      "email_compose",
      "email_delete",
      "email_mark_read",
      "email_move",
      "email_reply",
      "email_send",
      "email_star",
    ]);
  });

  it("permission tiers match the plan: send/reply/delete=user-confirm, bulk_delete=admin, rest=auto", () => {
    expect(send.permissionLevel).toBe("user-confirm");
    expect(reply.permissionLevel).toBe("user-confirm");
    expect(del.permissionLevel).toBe("user-confirm");
    expect(bulkDel.permissionLevel).toBe("admin");
    expect(compose.permissionLevel).toBe("auto");
    expect(markRead.permissionLevel).toBe("auto");
    expect(star.permissionLevel).toBe("auto");
    expect(move.permissionLevel).toBe("auto");
  });

  describe("email_compose", () => {
    it("returns a draft preview without calling sendEmail", async () => {
      const result = (await compose.execute({
        accountId: "acc-1",
        to: ["bob@example.com"],
        subject: "Hi",
        bodyText: "body",
      })) as { draft: { to: string[]; subject: string; cc: string[]; bodyHtml: string | null }; ready: boolean };

      expect(result.ready).toBe(true);
      expect(result.draft.to).toEqual(["bob@example.com"]);
      expect(result.draft.cc).toEqual([]);
      expect(result.draft.bodyHtml).toBeNull();
      expect(svc.sendEmail).not.toHaveBeenCalled();
    });

    it("rejects an invalid email address via zod", async () => {
      const result = (await compose.execute({
        accountId: "acc-1",
        to: ["not-an-email"],
        subject: "Hi",
        bodyText: "body",
      })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });

    it("rejects empty recipient list", async () => {
      const result = (await compose.execute({
        accountId: "acc-1",
        to: [],
        subject: "Hi",
        bodyText: "body",
      })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("email_send", () => {
    it("forwards the SendEmailInput to the service", async () => {
      svc.sendEmail.mockReturnValue(Promise.resolve(makeEmail({ id: "out-1" })));
      const result = (await send.execute({
        accountId: "acc-1",
        to: ["bob@example.com"],
        cc: ["carol@example.com"],
        subject: "Hi",
        bodyText: "body",
        bodyHtml: "<p>body</p>",
      })) as { sent: boolean; id: string };
      expect(result.sent).toBe(true);
      expect(result.id).toBe("out-1");
      const [accountId, input] = svc.sendEmail.mock.calls[0];
      expect(accountId).toBe("acc-1");
      expect((input as { to: string[]; cc: string[] }).cc).toEqual(["carol@example.com"]);
    });

    it("wraps a service throw as { error }", async () => {
      svc.sendEmail.mockReturnValue(Promise.reject(new Error("SMTP refused")));
      const result = (await send.execute({
        accountId: "acc-1",
        to: ["bob@example.com"],
        subject: "Hi",
        bodyText: "body",
      })) as { error?: string };
      expect(result.error).toBe("SMTP refused");
    });

    it("rejects an empty subject via zod", async () => {
      const result = (await send.execute({
        accountId: "acc-1",
        to: ["bob@example.com"],
        subject: "",
        bodyText: "body",
      })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe("email_reply", () => {
    it("uses the original sender as `to`, defaults cc to undefined", async () => {
      svc.getEmailById.mockReturnValue(Promise.resolve(makeEmail({ subject: "Q?", fromAddress: "alice@x.com" })));
      svc.sendEmail.mockReturnValue(Promise.resolve(makeEmail({ id: "rep-1" })));

      const result = (await reply.execute({ emailId: "e1", bodyText: "answer" })) as { sent: boolean; replyTo: string; subject: string };
      expect(result.sent).toBe(true);
      expect(result.replyTo).toBe("alice@x.com");
      expect(result.subject).toBe("Re: Q?");
      const [, input] = svc.sendEmail.mock.calls[0];
      expect((input as { to: string[]; cc: string[] | undefined }).to).toEqual(["alice@x.com"]);
      expect((input as { cc: string[] | undefined }).cc).toBeUndefined();
    });

    it("includes original CCs when replyAll=true", async () => {
      svc.getEmailById.mockReturnValue(Promise.resolve(makeEmail({ ccAddresses: [
        { name: null, address: "carol@x.com" },
        { name: null, address: "dave@x.com" },
      ] })));
      await reply.execute({ emailId: "e1", bodyText: "ok", replyAll: true });
      const [, input] = svc.sendEmail.mock.calls[0];
      expect((input as { cc: string[] }).cc).toEqual(["carol@x.com", "dave@x.com"]);
    });

    it("does not double-prefix Re: when subject already has it", async () => {
      svc.getEmailById.mockReturnValue(Promise.resolve(makeEmail({ subject: "Re: ongoing thread" })));
      const result = (await reply.execute({ emailId: "e1", bodyText: "more" })) as { subject: string };
      expect(result.subject).toBe("Re: ongoing thread");
    });

    it("returns an error when the original email is missing", async () => {
      svc.getEmailById.mockReturnValue(Promise.resolve(null));
      const result = (await reply.execute({ emailId: "ghost", bodyText: "x" })) as { error?: string };
      expect(result.error).toContain("introuvable");
      expect(svc.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe("email_mark_read / email_star", () => {
    it("email_mark_read defaults to isRead=true", async () => {
      svc.updateEmailFlags.mockReturnValue(Promise.resolve(makeEmail({ isRead: true })));
      await markRead.execute({ emailId: "e1" });
      expect(svc.updateEmailFlags).toHaveBeenCalledWith("e1", { isRead: true });
    });

    it("email_mark_read with isRead=false marks as unread", async () => {
      svc.updateEmailFlags.mockReturnValue(Promise.resolve(makeEmail({ isRead: false })));
      const result = (await markRead.execute({ emailId: "e1", isRead: false })) as { isRead: boolean };
      expect(result.isRead).toBe(false);
      expect(svc.updateEmailFlags).toHaveBeenCalledWith("e1", { isRead: false });
    });

    it("email_star defaults to isStarred=true", async () => {
      svc.updateEmailFlags.mockReturnValue(Promise.resolve(makeEmail({ isStarred: true })));
      await star.execute({ emailId: "e1" });
      expect(svc.updateEmailFlags).toHaveBeenCalledWith("e1", { isStarred: true });
    });

    it("flag tools surface a not-found error when service returns null", async () => {
      svc.updateEmailFlags.mockReturnValue(Promise.resolve(null));
      const result = (await markRead.execute({ emailId: "ghost" })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });
  });

  describe("email_move", () => {
    it("delegates and returns the resulting folder", async () => {
      svc.moveEmail.mockReturnValue(Promise.resolve(makeEmail({ folder: "Archive" })));
      const result = (await move.execute({ emailId: "e1", targetFolder: "Archive" })) as { moved: boolean; folder: string };
      expect(result.moved).toBe(true);
      expect(result.folder).toBe("Archive");
      expect(svc.moveEmail).toHaveBeenCalledWith("e1", "Archive");
    });

    it("returns a not-found error when service returns null", async () => {
      svc.moveEmail.mockReturnValue(Promise.resolve(null));
      const result = (await move.execute({ emailId: "ghost", targetFolder: "Archive" })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });

    it("rejects an empty targetFolder via zod", async () => {
      const result = (await move.execute({ emailId: "e1", targetFolder: "" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.moveEmail).not.toHaveBeenCalled();
    });

    it("wraps an IMAP move failure as { error }", async () => {
      svc.moveEmail.mockReturnValue(Promise.reject(new Error("Folder does not exist")));
      const result = (await move.execute({ emailId: "e1", targetFolder: "DoesNotExist" })) as { error?: string };
      expect(result.error).toBe("Folder does not exist");
    });
  });

  describe("email_delete / email_bulk_delete", () => {
    it("email_delete delegates and returns the id", async () => {
      svc.deleteEmail.mockReturnValue(Promise.resolve(true));
      const result = (await del.execute({ emailId: "e1" })) as { deleted: boolean; id: string };
      expect(result.deleted).toBe(true);
      expect(result.id).toBe("e1");
    });

    it("email_delete returns an error when service returns false", async () => {
      svc.deleteEmail.mockReturnValue(Promise.resolve(false));
      const result = (await del.execute({ emailId: "ghost" })) as { error?: string };
      expect(result.error).toContain("introuvable ou suppression IMAP echouee");
    });

    it("email_bulk_delete reports both deleted count and requested count", async () => {
      svc.bulkDeleteEmails.mockReturnValue(Promise.resolve(3));
      const result = (await bulkDel.execute({ emailIds: ["a", "b", "c", "d"] })) as { deleted: number; requested: number };
      expect(result.deleted).toBe(3);
      expect(result.requested).toBe(4);
    });

    it("email_bulk_delete caps at 100 ids via zod", async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);
      const result = (await bulkDel.execute({ emailIds: ids })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.bulkDeleteEmails).not.toHaveBeenCalled();
    });

    it("email_bulk_delete rejects empty list", async () => {
      const result = (await bulkDel.execute({ emailIds: [] })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });
});
