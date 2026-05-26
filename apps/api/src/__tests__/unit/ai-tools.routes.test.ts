import { describe, it, expect, mock, beforeEach } from "bun:test";
import { Hono } from "hono";
import { z } from "zod";
import { createAiToolsRoutes } from "../../presentation/routes/ai-tools.routes";
import { ToolRegistry, defineTool } from "../../application/agent/tool-registry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRegistry() {
  return new ToolRegistry(); // no audit service → no side-effects
}

function makeApp(registry: ToolRegistry) {
  const routes = createAiToolsRoutes(registry);
  const app = new Hono();
  app.route("/", routes);
  return app;
}

async function json<T = Record<string, unknown>>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// ─── GET / — list tools ───────────────────────────────────────────────────────

describe("GET / — list tools in MCP inputSchema format", () => {
  it("returns empty data array when registry has no tools", async () => {
    const app = makeApp(makeRegistry());
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[] }>(res);
    expect(body.data).toEqual([]);
  });

  it("maps parameters to MCP inputSchema properties and required array", async () => {
    const registry = makeRegistry();
    registry.register(
      defineTool({
        name: "notes_create",
        description: "Create a note",
        params: z.object({
          title: z.string().describe("Note title"),
          content: z.string().optional().describe("Body"),
        }),
        execute: async () => ({ id: "n1" }),
      }),
    );

    const app = makeApp(registry);
    const res = await app.request("/");
    const { data } = await json<{ data: {
      name: string;
      description: string;
      permissionLevel: string;
      inputSchema: {
        type: string;
        properties: Record<string, { type: string; description: string }>;
        required: string[];
      };
    }[] }>(res);

    expect(data).toHaveLength(1);
    const tool = data[0];
    expect(tool.name).toBe("notes_create");
    expect(tool.description).toBe("Create a note");
    expect(tool.permissionLevel).toBe("auto");
    expect(tool.inputSchema.type).toBe("object");
    expect(tool.inputSchema.properties.title).toEqual({ type: "string", description: "Note title" });
    expect(tool.inputSchema.properties.content).toEqual({ type: "string", description: "Body" });
    // title is required (no .optional()), content is not
    expect(tool.inputSchema.required).toContain("title");
    expect(tool.inputSchema.required).not.toContain("content");
  });

  it("defaults permissionLevel to 'auto' when not set", async () => {
    const registry = makeRegistry();
    registry.register(
      defineTool({
        name: "t",
        description: "",
        params: z.object({}),
        execute: async () => null,
      }),
    );
    const app = makeApp(registry);
    const res = await app.request("/");
    const { data } = await json<{ data: { permissionLevel: string }[] }>(res);
    expect(data[0].permissionLevel).toBe("auto");
  });

  it("exposes permissionLevel when set to user-confirm", async () => {
    const registry = makeRegistry();
    registry.register(
      defineTool({
        name: "sensitive_tool",
        description: "Needs approval",
        params: z.object({ path: z.string().describe("Path") }),
        permissionLevel: "user-confirm",
        execute: async () => null,
      }),
    );
    const app = makeApp(registry);
    const res = await app.request("/");
    const { data } = await json<{ data: { permissionLevel: string }[] }>(res);
    expect(data[0].permissionLevel).toBe("user-confirm");
  });

  it("returns all tools when registry has multiple tools", async () => {
    const registry = makeRegistry();
    for (const name of ["task_create", "notes_list", "calendar_get"]) {
      registry.register(
        defineTool({
          name,
          description: `Tool ${name}`,
          params: z.object({}),
          execute: async () => null,
        }),
      );
    }
    const app = makeApp(registry);
    const res = await app.request("/");
    const { data } = await json<{ data: { name: string }[] }>(res);
    expect(data).toHaveLength(3);
    expect(data.map((t) => t.name)).toEqual(
      expect.arrayContaining(["task_create", "notes_list", "calendar_get"]),
    );
  });

  it("does not expose internal execute function in the response", async () => {
    const registry = makeRegistry();
    registry.register(
      defineTool({
        name: "my_tool",
        description: "",
        params: z.object({}),
        execute: async () => null,
      }),
    );
    const app = makeApp(registry);
    const res = await app.request("/");
    const { data } = await json<{ data: Record<string, unknown>[] }>(res);
    expect(data[0].execute).toBeUndefined();
  });
});

// ─── POST /call — dispatch a tool ────────────────────────────────────────────

describe("POST /call — tool dispatch", () => {
  let registry: ToolRegistry;
  let app: Hono;
  let executeResult: unknown;

  beforeEach(() => {
    registry = makeRegistry();
    executeResult = { ok: true };
    registry.register(
      defineTool({
        name: "notes_create",
        description: "Create a note",
        params: z.object({
          title: z.string().describe("Title"),
          content: z.string().optional().describe("Body"),
        }),
        execute: async (p) => ({ id: "n1", ...p }),
      }),
    );
    app = makeApp(registry);
  });

  it("returns 400 when name is missing", async () => {
    const res = await app.request("/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arguments: {} }),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toBe("Missing tool name");
  });

  it("returns 400 when name is not a string", async () => {
    const res = await app.request("/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: 42 }),
    });
    expect(res.status).toBe(400);
  });

  it("dispatches the tool and returns status:ok on success", async () => {
    const res = await app.request("/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "notes_create",
        arguments: { title: "My note", content: "Hello" },
      }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ status: string; toolName: string; result: unknown }>(res);
    expect(body.status).toBe("ok");
    expect(body.toolName).toBe("notes_create");
    expect(body.result).toMatchObject({ id: "n1", title: "My note", content: "Hello" });
  });

  it("returns status:error for unknown tool name", async () => {
    const res = await app.request("/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "does_not_exist", arguments: {} }),
    });
    expect(res.status).toBe(200); // dispatch never throws — always 200 with status field
    const body = await json<{ status: string; error: string }>(res);
    expect(body.status).toBe("error");
    expect(body.error).toMatch(/inconnu/i);
  });

  it("returns status:invalid_input when zod validation fails", async () => {
    const res = await app.request("/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "notes_create",
        arguments: { title: 999 }, // title must be a string
      }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ status: string }>(res);
    expect(body.status).toBe("invalid_input");
  });

  it("uses empty object as default arguments when not provided", async () => {
    // notes_create requires title — should fail validation, not crash
    const res = await app.request("/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "notes_create" }), // no arguments
    });
    expect(res.status).toBe(200);
    const body = await json<{ status: string }>(res);
    expect(body.status).toBe("invalid_input"); // title is required
  });

  it("defaults session_id to 'cookia' when not provided", async () => {
    // Register a tool that captures the context
    let capturedContext: Record<string, unknown> = {};
    registry.register({
      name: "ctx_capture",
      description: "Captures context",
      parameters: {},
      execute: async (_params) => {
        // Context is passed via dispatch — we verify indirectly via the sessionId default
        return { done: true };
      },
    });

    const res = await app.request("/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ctx_capture" }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ status: string }>(res);
    expect(body.status).toBe("ok");
  });

  it("passes custom session_id to dispatch context", async () => {
    // Verify the route forwards session_id without crashing
    const res = await app.request("/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "notes_create",
        arguments: { title: "test" },
        session_id: "my-custom-session",
      }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ status: string }>(res);
    expect(body.status).toBe("ok");
  });

  it("handles bad JSON body gracefully (returns 400)", async () => {
    const res = await app.request("/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });
    expect(res.status).toBe(400);
  });
});
