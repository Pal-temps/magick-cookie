import { describe, it, expect, mock, beforeEach } from "bun:test";
import { z } from "zod";
import { ToolRegistry, defineTool, type AgentTool } from "../../application/agent/tool-registry";
import type { AiToolCallService } from "../../application/ai-tool-call/ai-tool-call.service";
import type { RecordToolCallInput } from "../../domain/ai-tool-call/ai-tool-call.entity";

function createAuditMock() {
  const records: RecordToolCallInput[] = [];
  const service: Partial<AiToolCallService> = {
    record: mock((input: RecordToolCallInput) => {
      records.push(input);
      return Promise.resolve({
        id: `rec-${records.length}`,
        conversationId: input.conversationId ?? null,
        sessionId: input.sessionId ?? null,
        toolName: input.toolName,
        permissionLevel: input.permissionLevel,
        args: input.args,
        result: input.result ?? null,
        errorMessage: input.errorMessage ?? null,
        status: input.status,
        durationMs: input.durationMs ?? null,
        createdAt: new Date(),
      });
    }),
    list: mock(() => Promise.resolve([])),
  };
  return { service: service as AiToolCallService, records };
}

describe("defineTool", () => {
  it("derives LLM parameters from a zod object schema", () => {
    const tool = defineTool({
      name: "my_tool",
      description: "Do the thing",
      params: z.object({
        count: z.number().int().describe("How many"),
        label: z.string().optional().describe("Optional tag"),
      }),
      execute: async () => ({ ok: true }),
    });

    expect(tool.parameters.count).toEqual({ type: "number", description: "How many", required: true });
    expect(tool.parameters.label).toEqual({ type: "string", description: "Optional tag", required: false });
  });

  it("defaults permissionLevel to 'auto'", () => {
    const tool = defineTool({
      name: "t",
      description: "",
      params: z.object({}),
      execute: async () => null,
    });
    expect(tool.permissionLevel).toBe("auto");
  });

  it("execute (called directly) returns structured error on invalid input", async () => {
    const tool = defineTool({
      name: "t",
      description: "",
      params: z.object({ n: z.number() }),
      execute: async ({ n }) => ({ doubled: n * 2 }),
    });

    const res = (await tool.execute({ n: "not a number" })) as { error?: string };
    expect(res.error).toBe("Parametres invalides");
  });

  it("execute (called directly) passes parsed params to the user handler", async () => {
    const tool = defineTool({
      name: "t",
      description: "",
      params: z.object({ n: z.number() }),
      execute: async ({ n }) => ({ doubled: n * 2 }),
    });
    const res = (await tool.execute({ n: 3 })) as { doubled: number };
    expect(res.doubled).toBe(6);
  });
});

describe("ToolRegistry.dispatch", () => {
  let audit: ReturnType<typeof createAuditMock>;
  let registry: ToolRegistry;

  beforeEach(() => {
    audit = createAuditMock();
    registry = new ToolRegistry(audit.service);
  });

  function addEchoTool(overrides: Partial<AgentTool> = {}) {
    const base = defineTool({
      name: "echo",
      description: "Echoes",
      params: z.object({ msg: z.string() }),
      execute: async ({ msg }) => ({ msg }),
    });
    registry.register({ ...base, ...overrides });
  }

  it("returns 'error' when tool is unknown and records audit", async () => {
    const res = await registry.dispatch("nope", {}, { conversationId: "c1" });
    expect(res.status).toBe("error");
    expect(res.error).toContain("Outil inconnu");
    expect(audit.records).toHaveLength(1);
    expect(audit.records[0].status).toBe("error");
    expect(audit.records[0].toolName).toBe("nope");
  });

  it("validates params via zod and records 'invalid_input' on failure", async () => {
    addEchoTool();
    const res = await registry.dispatch("echo", { msg: 123 }, { conversationId: "c1" });
    expect(res.status).toBe("invalid_input");
    expect(audit.records).toHaveLength(1);
    expect(audit.records[0].status).toBe("invalid_input");
  });

  it("executes the tool and records 'ok' with duration", async () => {
    addEchoTool();
    const res = await registry.dispatch("echo", { msg: "hello" }, { conversationId: "c1" });
    expect(res.status).toBe("ok");
    expect(res.result).toEqual({ msg: "hello" });
    expect(audit.records).toHaveLength(1);
    expect(audit.records[0].status).toBe("ok");
    expect(audit.records[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("catches thrown errors and records 'error'", async () => {
    registry.register(defineTool({
      name: "boom",
      description: "",
      params: z.object({}),
      execute: async () => {
        throw new Error("kaboom");
      },
    }));
    const res = await registry.dispatch("boom", {}, {});
    expect(res.status).toBe("error");
    expect(res.error).toBe("kaboom");
    expect(audit.records[0].status).toBe("error");
    expect(audit.records[0].errorMessage).toBe("kaboom");
  });

  it("denies tools with permissionLevel != 'auto' until the permission channel is wired", async () => {
    registry.register(defineTool({
      name: "sensitive",
      description: "",
      params: z.object({}),
      permissionLevel: "user-confirm",
      execute: async () => ({ ok: true }),
    }));
    const res = await registry.dispatch("sensitive", {}, {});
    expect(res.status).toBe("denied");
    expect(audit.records[0].status).toBe("denied");
    expect(audit.records[0].permissionLevel).toBe("user-confirm");
  });

  it("enforces rate limit and records 'rate_limited'", async () => {
    registry.register(defineTool({
      name: "limited",
      description: "",
      params: z.object({}),
      rateLimit: { limit: 3, windowMs: 60_000 },
      execute: async () => ({ ok: true }),
    }));

    // 3 allowed calls
    for (let i = 0; i < 3; i++) {
      const r = await registry.dispatch("limited", {}, { conversationId: "c1" });
      expect(r.status).toBe("ok");
    }
    // 4th call in the same window is rejected
    const fourth = await registry.dispatch("limited", {}, { conversationId: "c1" });
    expect(fourth.status).toBe("rate_limited");

    const rateLimitedRecord = audit.records.find((r) => r.status === "rate_limited");
    expect(rateLimitedRecord).toBeDefined();
  });

  it("rate limit is scoped per conversation", async () => {
    registry.register(defineTool({
      name: "limited",
      description: "",
      params: z.object({}),
      rateLimit: { limit: 1, windowMs: 60_000 },
      execute: async () => ({ ok: true }),
    }));

    const a = await registry.dispatch("limited", {}, { conversationId: "c1" });
    const b = await registry.dispatch("limited", {}, { conversationId: "c2" });
    // Different conversation keys -> both succeed.
    expect(a.status).toBe("ok");
    expect(b.status).toBe("ok");

    // Same conversation second call -> rate-limited.
    const a2 = await registry.dispatch("limited", {}, { conversationId: "c1" });
    expect(a2.status).toBe("rate_limited");
  });

  it("dispatch never throws if the audit service itself fails", async () => {
    const brokenService: Partial<AiToolCallService> = {
      record: mock(() => Promise.reject(new Error("DB down"))),
      list: mock(() => Promise.resolve([])),
    };
    const r = new ToolRegistry(brokenService as AiToolCallService);
    r.register(defineTool({
      name: "echo",
      description: "",
      params: z.object({ msg: z.string() }),
      execute: async ({ msg }) => ({ msg }),
    }));

    const res = await r.dispatch("echo", { msg: "hi" }, {});
    expect(res.status).toBe("ok");
  });
});

describe("ToolRegistry.describeForLlm", () => {
  it("renders tool list with permission note when not 'auto'", () => {
    const registry = new ToolRegistry();
    registry.register(defineTool({
      name: "safe",
      description: "Safe tool",
      params: z.object({ q: z.string().describe("Query") }),
      execute: async () => null,
    }));
    registry.register(defineTool({
      name: "unsafe",
      description: "Needs confirm",
      params: z.object({}),
      permissionLevel: "user-confirm",
      execute: async () => null,
    }));

    const out = registry.describeForLlm();
    expect(out).toContain("- **safe**");
    expect(out).toContain("Query");
    expect(out).toContain("[permission: user-confirm]");
  });
});
