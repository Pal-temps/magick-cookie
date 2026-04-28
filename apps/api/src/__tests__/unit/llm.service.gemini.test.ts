import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { LlmService } from "../../application/llm/llm.service";
import type { LlmConfigRepository } from "../../domain/llm/llm-config.repository";
import type { LlmConfig } from "../../domain/llm/llm-config.entity";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

const makeGeminiConfig = (overrides: Partial<LlmConfig> = {}): LlmConfig => ({
  id: "cfg-gemini",
  provider: "gemini",
  baseUrl: GEMINI_BASE_URL,
  model: "gemini-2.0-flash",
  apiKey: "test-api-key",
  maxTokens: 2048,
  temperature: 0.7,
  enabled: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

const OPENAI_STYLE_RESPONSE = JSON.stringify({
  choices: [{ message: { content: "Gemini response" } }],
});

describe("LlmService — Gemini", () => {
  let service: LlmService;
  let mockConfigRepo: Record<keyof LlmConfigRepository, ReturnType<typeof mock>>;
  let capturedFetchUrl: string | null;
  let capturedFetchHeaders: Record<string, string> | null;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    capturedFetchUrl = null;
    capturedFetchHeaders = null;
    mockConfigRepo = {
      getActive: mock(() => Promise.resolve(makeGeminiConfig())),
      upsert: mock(() => Promise.resolve(makeGeminiConfig())),
    };
    globalThis.fetch = mock(async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedFetchUrl = url.toString();
      capturedFetchHeaders = Object.fromEntries(
        new Headers(init?.headers).entries(),
      );
      return new Response(OPENAI_STYLE_RESPONSE, { status: 200 });
    }) as typeof fetch;
    service = new LlmService(mockConfigRepo as unknown as LlmConfigRepository);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("appelle l'endpoint Gemini OpenAI-compatible", async () => {
    await service.chat([{ role: "user", content: "Hello" }]);
    expect(capturedFetchUrl).not.toBeNull();
    expect(capturedFetchUrl!).toContain("generativelanguage.googleapis.com");
    expect(capturedFetchUrl!).toContain("chat/completions");
  });

  it("injecte le header Authorization Bearer avec l'API key", async () => {
    await service.chat([{ role: "user", content: "Hello" }]);
    expect(capturedFetchHeaders).not.toBeNull();
    expect(capturedFetchHeaders!["authorization"]).toBe("Bearer test-api-key");
  });

  it("utilise le format OpenAI-compatible pour le corps de la requête", async () => {
    let capturedBody: any = null;
    globalThis.fetch = mock(async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(OPENAI_STYLE_RESPONSE, { status: 200 });
    }) as typeof fetch;

    await service.chat([{ role: "user", content: "Test" }]);
    expect(capturedBody).not.toBeNull();
    expect(capturedBody.messages).toBeDefined();
    expect(capturedBody.model).toBe("gemini-2.0-flash");
  });

  it("lève une erreur si apiKey est absent pour Gemini", async () => {
    mockConfigRepo.getActive.mockReturnValue(
      Promise.resolve(makeGeminiConfig({ apiKey: null })),
    );
    await expect(service.chat([{ role: "user", content: "Hello" }])).rejects.toThrow();
  });

  it("retourne le texte de la réponse Gemini", async () => {
    const response = await service.chat([{ role: "user", content: "Hello" }]);
    expect(response).toBe("Gemini response");
  });
});
