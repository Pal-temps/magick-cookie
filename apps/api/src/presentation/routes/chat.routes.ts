import { Hono } from "hono";
import type { ChatService } from "../../application/chat/chat.service";

export function createChatRoutes(chatService: ChatService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const data = await chatService.listConversations();
    return c.json({ data });
  });

  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const data = await chatService.createConversation(body.title);
    return c.json({ data }, 201);
  });

  app.get("/:id/messages", async (c) => {
    const data = await chatService.getMessages(c.req.param("id"));
    return c.json({ data });
  });

  app.post("/:id/messages", async (c) => {
    const { content } = await c.req.json();
    if (!content) return c.json({ error: "content required" }, 400);
    try {
      const data = await chatService.sendMessage(c.req.param("id"), content);
      return c.json({ data });
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  app.delete("/:id", async (c) => {
    const deleted = await chatService.deleteConversation(c.req.param("id"));
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ data: { ok: true } });
  });

  return app;
}
