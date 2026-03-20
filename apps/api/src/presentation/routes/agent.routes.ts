import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AgentService } from "../../application/agent/agent.service";

export function createAgentRoutes(agentService: AgentService) {
  const app = new Hono();

  // GET / — list conversations (same as chat)
  app.get("/", async (c) => {
    const data = await agentService.listConversations();
    return c.json({ data });
  });

  // POST / — create conversation
  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const data = await agentService.createConversation(body.title);
    return c.json({ data });
  });

  // GET /:id/messages — get messages
  app.get("/:id/messages", async (c) => {
    const data = await agentService.getMessages(c.req.param("id"));
    return c.json({ data });
  });

  // POST /:id/messages — send message (with tool-calling)
  app.post("/:id/messages", async (c) => {
    const { message } = await c.req.json();
    if (!message || typeof message !== "string") {
      return c.json({ error: "message required" }, 400);
    }
    const result = await agentService.sendMessage(c.req.param("id"), message);
    return c.json({
      data: result.message,
      toolCalls: result.toolCalls,
    });
  });

  // POST /:id/messages/stream — send message with SSE streaming
  app.post("/:id/messages/stream", async (c) => {
    const { message } = await c.req.json();
    if (!message || typeof message !== "string") {
      return c.json({ error: "message required" }, 400);
    }
    const convId = c.req.param("id");
    return streamSSE(c, async (stream) => {
      try {
        for await (const event of agentService.sendMessageStream(convId, message)) {
          await stream.writeSSE({ event: event.type, data: event.data });
        }
      } catch (err: any) {
        await stream.writeSSE({ event: "error", data: err.message ?? String(err) });
      }
    });
  });

  // DELETE /:id — delete conversation
  app.delete("/:id", async (c) => {
    await agentService.deleteConversation(c.req.param("id"));
    return c.json({ success: true });
  });

  return app;
}
