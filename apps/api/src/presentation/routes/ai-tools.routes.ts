import { Hono } from "hono";
import type { ToolRegistry } from "../../application/agent/tool-registry";

/**
 * MCP tool bridge — used by the Cookia MCP server (magick-mcp-server.ts).
 *
 * GET  /api/ai/tools         — list all registered tools in MCP inputSchema format
 * POST /api/ai/tools/call    — dispatch a tool and return its result
 */
export function createAiToolsRoutes(toolRegistry: ToolRegistry) {
  const app = new Hono();

  /**
   * GET /api/ai/tools
   * Returns every registered tool in MCP inputSchema format so the Cookia
   * MCP server can expose them to Claude CLI.
   */
  app.get("/", (c) => {
    const tools = toolRegistry.all().map((t) => {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, param] of Object.entries(t.parameters)) {
        properties[key] = { type: param.type, description: param.description };
        if (param.required !== false) required.push(key);
      }
      return {
        name: t.name,
        description: t.description,
        permissionLevel: t.permissionLevel ?? "auto",
        inputSchema: { type: "object", properties, required },
      };
    });
    return c.json({ data: tools });
  });

  /**
   * POST /api/ai/tools/call
   * Body: { name: string; arguments?: Record<string, unknown>; session_id?: string }
   * Dispatches the named tool through the registry and returns a ToolDispatchResult.
   */
  app.post("/call", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.name || typeof body.name !== "string") {
      return c.json({ error: "Missing tool name" }, 400);
    }
    const result = await toolRegistry.dispatch(
      body.name,
      (body.arguments ?? {}) as Record<string, unknown>,
      { sessionId: (body.session_id as string | undefined) ?? "cookia" },
    );
    return c.json(result);
  });

  return app;
}
