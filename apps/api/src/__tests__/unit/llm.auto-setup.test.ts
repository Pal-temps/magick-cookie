import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { Hono } from "hono";
import type { LlmService } from "../../application/llm/llm.service";
import type { LlmConfig } from "../../domain/llm/llm-config.entity";
import { createLlmRoutes } from "../../presentation/routes/llm.routes";

const makeConfig = (overrides: Partial<LlmConfig> = {}): LlmConfig => ({
  id: "cfg-1",
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  model: "llama3.2:3b",
  apiKey: null,
  maxTokens: 2048,
  temperature: 0.7,
  enabled: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("POST /api/llm/auto-setup", () => {
  let app: Hono;
  let mockLlmService: Record<string, ReturnType<typeof mock>>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockLlmService = {
      getConfig: mock(() => Promise.resolve(null)),
      updateConfig: mock((input: any) => Promise.resolve(makeConfig(input))),
      chat: mock(() => Promise.resolve("")),
      chatStream: mock(),
      summarize: mock(() => Promise.resolve("")),
      classify: mock(() => Promise.resolve("")),
      generateNarrative: mock(() => Promise.resolve("")),
      generateEvents: mock(() => Promise.resolve([])),
      generateRssDigest: mock(() => Promise.resolve({ highlights: [], summary: "", categories: [] })),
      testConnection: mock(() => Promise.resolve(true)),
    };

    const routes = createLlmRoutes(mockLlmService as unknown as LlmService);
    app = new Hono();
    app.route("/api/llm", routes);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns configured:true with source 'existing' when config already exists", async () => {
    mockLlmService.getConfig.mockReturnValue(Promise.resolve(makeConfig()));

    const res = await app.request("/api/llm/auto-setup", { method: "POST" });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual({ configured: true, source: "existing" });
    expect(mockLlmService.updateConfig).not.toHaveBeenCalled();
  });

  test("auto-configures Ollama when reachable with models, picks preferred model", async () => {
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({ models: [{ name: "mistral:7b" }, { name: "llama3.2:3b" }, { name: "phi:latest" }] }),
        { status: 200 },
      ),
    ) as typeof fetch;

    const res = await app.request("/api/llm/auto-setup", { method: "POST" });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.configured).toBe(true);
    expect(json.data.source).toBe("ollama");
    expect(json.data.model).toBe("llama3.2:3b");
    expect(mockLlmService.updateConfig).toHaveBeenCalledWith({
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      model: "llama3.2:3b",
      enabled: true,
    });
  });

  test("falls back to first available model when no preferred model found", async () => {
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({ models: [{ name: "custom-model:latest" }, { name: "other:2b" }] }),
        { status: 200 },
      ),
    ) as typeof fetch;

    const res = await app.request("/api/llm/auto-setup", { method: "POST" });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.configured).toBe(true);
    expect(json.data.source).toBe("ollama");
    expect(json.data.model).toBe("custom-model:latest");
  });

  test("returns configured:false with reason 'ollama_unreachable' when fetch throws", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("Connection refused");
    }) as typeof fetch;

    const res = await app.request("/api/llm/auto-setup", { method: "POST" });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual({ configured: false, reason: "ollama_unreachable" });
    expect(mockLlmService.updateConfig).not.toHaveBeenCalled();
  });

  test("returns configured:false with reason 'no_models' when Ollama has empty model list", async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ models: [] }), { status: 200 }),
    ) as typeof fetch;

    const res = await app.request("/api/llm/auto-setup", { method: "POST" });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual({ configured: false, reason: "no_models" });
    expect(mockLlmService.updateConfig).not.toHaveBeenCalled();
  });

  test("returns configured:false with reason 'ollama_unreachable' when Ollama returns non-ok status", async () => {
    globalThis.fetch = mock(async () =>
      new Response("Internal Server Error", { status: 500 }),
    ) as typeof fetch;

    const res = await app.request("/api/llm/auto-setup", { method: "POST" });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual({ configured: false, reason: "ollama_unreachable" });
  });
});
