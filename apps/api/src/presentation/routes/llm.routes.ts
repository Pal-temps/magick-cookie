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

  // POST /api/llm/auto-setup — auto-detect and configure Ollama if running
  app.post("/auto-setup", async (c) => {
    const existing = await llmService.getConfig();
    if (existing) return c.json({ data: { configured: true, source: "existing" } });

    // Try to reach Ollama
    try {
      const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return c.json({ data: { configured: false, reason: "ollama_unreachable" } });

      const json = await res.json() as { models?: { name: string }[] };
      const models = json.models ?? [];
      if (models.length === 0) return c.json({ data: { configured: false, reason: "no_models" } });

      // Pick best available model
      const preferred = ["llama3.2:3b", "llama3.2:1b", "llama3.1:8b", "llama3:8b", "mistral:7b"];
      const model = preferred.find((m) => models.some((am) => am.name === m)) ?? models[0].name;

      const config = await llmService.updateConfig({
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        model,
        enabled: true,
      });

      return c.json({ data: { configured: true, source: "ollama", model: config.model } });
    } catch {
      return c.json({ data: { configured: false, reason: "ollama_unreachable" } });
    }
  });

  return app;
}
