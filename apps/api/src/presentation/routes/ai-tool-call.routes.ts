import { Hono } from "hono";
import { z } from "zod";
import type { AiToolCallService } from "../../application/ai-tool-call/ai-tool-call.service";
import type { ToolCallStatus } from "../../domain/ai-tool-call/ai-tool-call.entity";

const TOOL_CALL_STATUSES = ["ok", "error", "denied", "invalid_input", "rate_limited"] as const;

const listQuerySchema = z.object({
  conversationId: z.string().min(1).max(100).optional(),
  toolName: z.string().min(1).max(100).optional(),
  status: z.enum(TOOL_CALL_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function createAiToolCallRoutes(service: AiToolCallService) {
  const app = new Hono();

  // GET /api/ai/tool-calls?conversationId=&toolName=&status=&limit=&offset=
  app.get("/", async (c) => {
    const parsed = listQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json({ error: "Invalid query", details: parsed.error.issues }, 400);
    }
    const calls = await service.list({
      conversationId: parsed.data.conversationId,
      toolName: parsed.data.toolName,
      status: parsed.data.status as ToolCallStatus | undefined,
      limit: parsed.data.limit ?? 100,
      offset: parsed.data.offset,
    });
    return c.json({ data: calls });
  });

  // GET /api/ai/tool-calls/stats — aggregations over the most recent N calls
  app.get("/stats", async (c) => {
    const stats = await service.getStats();
    return c.json({ data: stats });
  });

  return app;
}
