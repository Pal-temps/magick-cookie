import { Hono } from "hono";
import type { LlmService } from "../../application/llm/llm.service";
import { updateLlmConfigSchema, chatSchema, generateEventsSchema } from "../validators/llm.validator";

export function createLlmRoutes(llmService: LlmService) {
  const app = new Hono();

  // GET /api/llm/config
  app.get("/config", async (c) => {
    const config = await llmService.getConfig();
    return c.json({ data: config });
  });

  // PUT /api/llm/config
  app.put("/config", async (c) => {
    const input = updateLlmConfigSchema.parse(await c.req.json());
    const config = await llmService.updateConfig(input);
    return c.json({ data: config });
  });

  // POST /api/llm/chat
  app.post("/chat", async (c) => {
    const { messages } = chatSchema.parse(await c.req.json());
    const response = await llmService.chat(messages);
    return c.json({ data: { response } });
  });

  // POST /api/llm/generate-events
  app.post("/generate-events", async (c) => {
    const { prompt, date } = generateEventsSchema.parse(await c.req.json());
    const events = await llmService.generateEvents(prompt, date);
    return c.json({ data: { events } });
  });

  // POST /api/llm/test
  app.post("/test", async (c) => {
    const success = await llmService.testConnection();
    return c.json({ data: { success } });
  });

  return app;
}
