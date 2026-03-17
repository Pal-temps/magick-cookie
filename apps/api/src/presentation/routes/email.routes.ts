import { Hono } from "hono";
import type { EmailService } from "../../application/email/email.service";
import type { LlmService } from "../../application/llm/llm.service";
import {
  createEmailAccountSchema,
  updateEmailAccountSchema,
  updateEmailFlagsSchema,
  emailQuerySchema,
} from "../validators/email.validator";

export function createEmailRoutes(emailService: EmailService, llmService?: LlmService) {
  const app = new Hono();

  // GET /api/emails — inbox unifiée
  app.get("/", async (c) => {
    const query = emailQuerySchema.parse(c.req.query());
    const data = await emailService.getEmails(query);
    return c.json({ data });
  });

  // GET /api/emails/digest
  app.get("/digest", async (c) => {
    const days = Number(c.req.query("days") || "7");
    const digest = await emailService.getDigest(days);
    let summary = "";
    if (llmService) {
      try {
        summary = await llmService.summarize(
          JSON.stringify(digest),
          "Resume ce digest email en francais. Groupe par expediteur, mentionne les sujets importants. 3-5 bullet points max.",
        );
      } catch {
        // LLM not available — return structured data only
      }
    }
    return c.json({ data: { ...digest, summary } });
  });

  // GET /api/emails/unread-count
  app.get("/unread-count", async (c) => {
    const accountId = c.req.query("accountId");
    const count = await emailService.getUnreadCount(accountId);
    return c.json({ data: { count } });
  });

  // GET /api/emails/:id
  app.get("/:id", async (c) => {
    const email = await emailService.getEmailById(c.req.param("id"));
    if (!email) return c.json({ error: "Email not found" }, 404);
    return c.json({ data: email });
  });

  // PATCH /api/emails/:id — update flags
  app.patch("/:id", async (c) => {
    const flags = updateEmailFlagsSchema.parse(await c.req.json());
    const email = await emailService.updateEmailFlags(c.req.param("id"), flags);
    if (!email) return c.json({ error: "Email not found" }, 404);
    return c.json({ data: email });
  });

  // DELETE /api/emails/:id
  app.delete("/:id", async (c) => {
    const deleted = await emailService.deleteEmail(c.req.param("id"));
    if (!deleted) return c.json({ error: "Email not found" }, 404);
    return c.json({ data: { ok: true } });
  });

  // POST /api/emails/:id/summarize
  app.post("/:id/summarize", async (c) => {
    if (!llmService) return c.json({ error: "LLM not configured" }, 400);

    const email = await emailService.getEmailById(c.req.param("id"));
    if (!email) return c.json({ error: "Email not found" }, 404);

    let text = email.bodyText || "";
    if (!text && email.bodyHtml) {
      text = email.bodyHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }

    if (!text) return c.json({ error: "Email has no content" }, 400);

    const summary = await llmService.summarize(
      text,
      "Resume cet email en 2-3 phrases en francais. Extrais les actions requises s'il y en a.",
    );

    return c.json({ data: { summary } });
  });

  return app;
}

export function createEmailAccountRoutes(emailService: EmailService) {
  const app = new Hono();

  // GET /api/email-accounts
  app.get("/", async (c) => {
    const data = await emailService.getAccounts();
    return c.json({ data });
  });

  // POST /api/email-accounts
  app.post("/", async (c) => {
    const input = createEmailAccountSchema.parse(await c.req.json());
    const data = await emailService.createAccount(input);
    return c.json({ data }, 201);
  });

  // PUT /api/email-accounts/:id
  app.put("/:id", async (c) => {
    const input = updateEmailAccountSchema.parse(await c.req.json());
    const data = await emailService.updateAccount(c.req.param("id"), input);
    if (!data) return c.json({ error: "Account not found" }, 404);
    return c.json({ data });
  });

  // DELETE /api/email-accounts/:id
  app.delete("/:id", async (c) => {
    const deleted = await emailService.deleteAccount(c.req.param("id"));
    if (!deleted) return c.json({ error: "Account not found" }, 404);
    return c.json({ data: { ok: true } });
  });

  // POST /api/email-accounts/:id/sync — forcer sync
  app.post("/:id/sync", async (c) => {
    const result = await emailService.syncAccount(c.req.param("id"));
    return c.json({ data: result });
  });

  // POST /api/email-accounts/test-connection
  app.post("/test-connection", async (c) => {
    const input = createEmailAccountSchema.parse(await c.req.json());
    const success = await emailService.testConnection(input);
    return c.json({ data: { success } });
  });

  return app;
}
