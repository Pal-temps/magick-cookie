import { Hono } from "hono";
import type { EmailRuleService } from "../../application/email/email-rule.service";
import {
  createEmailRuleSchema,
  updateEmailRuleSchema,
} from "../validators/email-rule.validator";

export function createEmailRuleRoutes(emailRuleService: EmailRuleService) {
  const app = new Hono();

  // GET /api/email-rules
  app.get("/", async (c) => {
    const data = await emailRuleService.getRules();
    return c.json({ data });
  });

  // GET /api/email-rules/:id
  app.get("/:id", async (c) => {
    const data = await emailRuleService.getRuleById(c.req.param("id"));
    if (!data) return c.json({ error: "Email rule not found" }, 404);
    return c.json({ data });
  });

  // POST /api/email-rules
  app.post("/", async (c) => {
    const input = createEmailRuleSchema.parse(await c.req.json());
    const data = await emailRuleService.createRule(input);
    return c.json({ data }, 201);
  });

  // PUT /api/email-rules/:id
  app.put("/:id", async (c) => {
    const input = updateEmailRuleSchema.parse(await c.req.json());
    const data = await emailRuleService.updateRule(c.req.param("id"), input);
    if (!data) return c.json({ error: "Email rule not found" }, 404);
    return c.json({ data });
  });

  // DELETE /api/email-rules/:id
  app.delete("/:id", async (c) => {
    const deleted = await emailRuleService.deleteRule(c.req.param("id"));
    if (!deleted) return c.json({ error: "Email rule not found" }, 404);
    return c.json({ data: { ok: true } });
  });

  return app;
}
