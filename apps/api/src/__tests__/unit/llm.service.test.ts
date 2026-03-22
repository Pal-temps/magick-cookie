import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { LlmService } from "../../application/llm/llm.service";
import type { LlmConfigRepository } from "../../domain/llm/llm-config.repository";
import type { LlmConfig } from "../../domain/llm/llm-config.entity";

const makeConfig = (overrides: Partial<LlmConfig> = {}): LlmConfig => ({
  id: "cfg-1",
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  model: "llama3.2",
  apiKey: null,
  maxTokens: 2048,
  temperature: 0.7,
  enabled: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

// Helper: mock fetch to return a canned response for any adapter
function mockFetchForOllama(response: string) {
  globalThis.fetch = mock(async () =>
    new Response(JSON.stringify({ message: { content: response } }), { status: 200 }),
  ) as typeof fetch;
}

function mockFetchForOpenAI(response: string) {
  globalThis.fetch = mock(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: response } }] }), { status: 200 }),
  ) as typeof fetch;
}

function mockFetchForAnthropic(response: string) {
  globalThis.fetch = mock(async () =>
    new Response(JSON.stringify({ content: [{ type: "text", text: response }] }), { status: 200 }),
  ) as typeof fetch;
}

describe("LlmService", () => {
  let service: LlmService;
  let mockConfigRepo: Record<keyof LlmConfigRepository, ReturnType<typeof mock>>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockConfigRepo = {
      getActive: mock(() => Promise.resolve(makeConfig())),
      upsert: mock((input: any) => Promise.resolve(makeConfig(input))),
    };
    service = new LlmService(mockConfigRepo as unknown as LlmConfigRepository);
    mockFetchForOllama("mocked-response");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /* ====== getConfig ====== */

  describe("getConfig", () => {
    it("should return the active config", async () => {
      const result = await service.getConfig();
      expect(result).toBeDefined();
      expect(result!.provider).toBe("ollama");
      expect(mockConfigRepo.getActive).toHaveBeenCalledTimes(1);
    });

    it("should return null when no config exists", async () => {
      mockConfigRepo.getActive.mockReturnValue(Promise.resolve(null));
      const result = await service.getConfig();
      expect(result).toBeNull();
    });
  });

  /* ====== updateConfig ====== */

  describe("updateConfig", () => {
    it("should upsert and return the new config", async () => {
      const input = { provider: "lmstudio", baseUrl: "http://localhost:1234", model: "mistral" };
      const result = await service.updateConfig(input);
      expect(result.provider).toBe("lmstudio");
      expect(mockConfigRepo.upsert).toHaveBeenCalledWith(input);
    });
  });

  /* ====== chat ====== */

  describe("chat", () => {
    it("should throw when no config is set", async () => {
      mockConfigRepo.getActive.mockReturnValue(Promise.resolve(null));
      await expect(service.chat([{ role: "user", content: "hello" }])).rejects.toThrow("No LLM configured");
    });

    it("should call adapter.chat and return response (ollama)", async () => {
      const result = await service.chat([{ role: "user", content: "hello" }]);
      expect(result).toBe("mocked-response");
    });

    it("should use anthropic adapter when provider is anthropic", async () => {
      mockConfigRepo.getActive.mockReturnValue(
        Promise.resolve(makeConfig({ provider: "anthropic", apiKey: "sk-test" })),
      );
      mockFetchForAnthropic("anthropic-response");
      const result = await service.chat([{ role: "user", content: "hi" }]);
      expect(result).toBe("anthropic-response");
    });

    it("should use openai-compatible adapter when provider is openai-compatible", async () => {
      mockConfigRepo.getActive.mockReturnValue(
        Promise.resolve(makeConfig({ provider: "openai-compatible", baseUrl: "http://localhost:8080" })),
      );
      mockFetchForOpenAI("openai-response");
      const result = await service.chat([{ role: "user", content: "hi" }]);
      expect(result).toBe("openai-response");
    });

    it("should use openai-compatible adapter when provider is lmstudio", async () => {
      mockConfigRepo.getActive.mockReturnValue(
        Promise.resolve(makeConfig({ provider: "lmstudio", baseUrl: "http://localhost:1234" })),
      );
      mockFetchForOpenAI("lmstudio-response");
      const result = await service.chat([{ role: "user", content: "hi" }]);
      expect(result).toBe("lmstudio-response");
    });

    it("should default to OllamaAdapter for unknown providers", async () => {
      mockConfigRepo.getActive.mockReturnValue(
        Promise.resolve(makeConfig({ provider: "some-unknown" })),
      );
      mockFetchForOllama("default-response");
      const result = await service.chat([{ role: "user", content: "test" }]);
      expect(result).toBe("default-response");
    });
  });

  /* ====== summarize ====== */

  describe("summarize", () => {
    it("should send system prompt and text as user message", async () => {
      const result = await service.summarize("some text", "summarize this");
      expect(result).toBe("mocked-response");
    });
  });

  /* ====== classify ====== */

  describe("classify", () => {
    const categories = ["urgent", "info", "spam", "autre"];

    it("should return the category when response matches exactly", async () => {
      mockFetchForOllama("urgent");
      const result = await service.classify("important email", categories);
      expect(result).toBe("urgent");
    });

    it("should normalize response by trimming whitespace and lowering case", async () => {
      mockFetchForOllama("  Info  \n");
      const result = await service.classify("newsletter content", categories);
      expect(result).toBe("info");
    });

    it("should fallback to 'autre' when response is not in categories", async () => {
      mockFetchForOllama("unknown-category");
      const result = await service.classify("weird email", categories);
      expect(result).toBe("autre");
    });

    it("should fallback to 'autre' when LLM returns a sentence", async () => {
      mockFetchForOllama("I think this is urgent because...");
      const result = await service.classify("some text", categories);
      expect(result).toBe("autre");
    });
  });

  /* ====== generateNarrative ====== */

  describe("generateNarrative", () => {
    it("should send system prompt and data as user message", async () => {
      const result = await service.generateNarrative('{"total": 42}', "Generate a report");
      expect(result).toBe("mocked-response");
    });

    it("should propagate errors from chat", async () => {
      mockConfigRepo.getActive.mockReturnValue(Promise.resolve(null));
      await expect(service.generateNarrative("data", "prompt")).rejects.toThrow("No LLM configured");
    });
  });

  /* ====== testConnection ====== */

  describe("testConnection", () => {
    it("should return false when no config exists", async () => {
      mockConfigRepo.getActive.mockReturnValue(Promise.resolve(null));
      const result = await service.testConnection();
      expect(result).toBe(false);
    });

    it("should return true when adapter connection succeeds", async () => {
      mockFetchForOllama("OK");
      const result = await service.testConnection();
      expect(result).toBe(true);
    });

    it("should return false when adapter connection fails", async () => {
      globalThis.fetch = mock(async () =>
        new Response("error", { status: 500 }),
      ) as typeof fetch;
      const result = await service.testConnection();
      expect(result).toBe(false);
    });
  });

  /* ====== createAdapter edge cases ====== */

  describe("createAdapter (via chat)", () => {
    it("should throw when anthropic provider has no apiKey", async () => {
      mockConfigRepo.getActive.mockReturnValue(
        Promise.resolve(makeConfig({ provider: "anthropic", apiKey: null })),
      );
      await expect(service.chat([{ role: "user", content: "test" }])).rejects.toThrow("Anthropic API key required");
    });

    it("should throw when anthropic provider has empty string apiKey", async () => {
      mockConfigRepo.getActive.mockReturnValue(
        Promise.resolve(makeConfig({ provider: "anthropic", apiKey: "" })),
      );
      await expect(service.chat([{ role: "user", content: "test" }])).rejects.toThrow("Anthropic API key required");
    });
  });

  /* ====== generateRssDigest — JSON parsing ====== */

  describe("generateRssDigest", () => {
    const articles = [
      { feedLabel: "TechCrunch", title: "AI Update", description: "Big news", link: "https://example.com/1", publishedAt: "2026-03-20" },
    ];

    const validJson = JSON.stringify({
      highlights: [{ title: "AI Update", feedLabel: "TechCrunch", reason: "Important", link: "https://example.com/1" }],
      summary: "Tech news today.",
      categories: [{ name: "Tech", count: 1, topArticle: "AI Update" }],
    });

    it("parses raw JSON response", async () => {
      mockFetchForOllama(validJson);
      const result = await service.generateRssDigest(articles);
      expect(result.highlights).toHaveLength(1);
      expect(result.highlights[0].title).toBe("AI Update");
      expect(result.summary).toBe("Tech news today.");
      expect(result.categories).toHaveLength(1);
    });

    it("parses JSON wrapped in ```json markdown fences", async () => {
      mockFetchForOllama("```json\n" + validJson + "\n```");
      const result = await service.generateRssDigest(articles);
      expect(result.highlights).toHaveLength(1);
      expect(result.summary).toBe("Tech news today.");
    });

    it("parses JSON wrapped in ``` markdown fences (no language)", async () => {
      mockFetchForOllama("```\n" + validJson + "\n```");
      const result = await service.generateRssDigest(articles);
      expect(result.highlights).toHaveLength(1);
    });

    it("parses JSON with leading text before the object", async () => {
      mockFetchForOllama("Here is the result:\n" + validJson);
      const result = await service.generateRssDigest(articles);
      expect(result.highlights).toHaveLength(1);
    });

    it("returns empty result when LLM returns garbage", async () => {
      mockFetchForOllama("I cannot process this request.");
      const result = await service.generateRssDigest(articles);
      expect(result.highlights).toEqual([]);
      expect(result.summary).toBe("");
      expect(result.categories).toEqual([]);
    });

    it("returns empty result when LLM returns invalid JSON", async () => {
      mockFetchForOllama("{invalid json here}}}");
      const result = await service.generateRssDigest(articles);
      expect(result.highlights).toEqual([]);
    });

    it("handles missing fields gracefully", async () => {
      mockFetchForOllama('{"summary": "Just a summary"}');
      const result = await service.generateRssDigest(articles);
      expect(result.summary).toBe("Just a summary");
      expect(result.highlights).toEqual([]);
      expect(result.categories).toEqual([]);
    });
  });
});
