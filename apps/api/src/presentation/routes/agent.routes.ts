import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AgentService } from "../../application/agent/agent.service";
import { uuidSchema } from "../validators/shared.validator";
import { createConversationSchema, sendMessageSchema } from "../validators/agent.validator";

export function createAgentRoutes(agentService: AgentService) {
  const app = new Hono();

  const parseId = (value: string) => uuidSchema.safeParse(value);

  // GET / — list conversations (same as chat)
  app.get("/", async (c) => {
    const data = await agentService.listConversations();
    return c.json({ data });
  });

  // POST / — create conversation
  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createConversationSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const data = await agentService.createConversation(parsed.data.title);
    return c.json({ data });
  });

  // GET /:id/messages — get messages
  app.get("/:id/messages", async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id.success) return c.json({ error: "Invalid id" }, 400);
    const data = await agentService.getMessages(id.data);
    return c.json({ data });
  });

  // POST /:id/messages — send message (with tool-calling)
  app.post("/:id/messages", async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id.success) return c.json({ error: "Invalid id" }, 400);
    const parsed = sendMessageSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const result = await agentService.sendMessage(id.data, parsed.data.message);
    return c.json({ data: result.message, toolCalls: result.toolCalls });
  });

  // POST /:id/messages/stream — send message with SSE streaming
  app.post("/:id/messages/stream", async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id.success) return c.json({ error: "Invalid id" }, 400);
    const parsed = sendMessageSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    return streamSSE(c, async (stream) => {
      try {
        for await (const event of agentService.sendMessageStream(id.data, parsed.data.message)) {
          await stream.writeSSE({ event: event.type, data: event.data });
        }
      } catch (err: any) {
        await stream.writeSSE({ event: "error", data: err.message ?? String(err) });
      }
    });
  });

  // DELETE /:id — delete conversation
  app.delete("/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id.success) return c.json({ error: "Invalid id" }, 400);
    await agentService.deleteConversation(id.data);
    return c.json({ success: true });
  });

  return app;
}
