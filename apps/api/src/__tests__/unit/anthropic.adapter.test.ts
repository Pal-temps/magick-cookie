import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { AnthropicAdapter } from "../../infrastructure/adapters/anthropic.adapter";

const API_KEY = "test-api-key";
const MODEL = "claude-3-haiku-20240307";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

describe("AnthropicAdapter", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── baseUrl handling ──────────────────────────────────────────────

  describe("baseUrl", () => {
    it("should use the default base URL when none is provided", async () => {
      globalThis.fetch = mock(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe("https://api.anthropic.com/v1/messages");
        return jsonResponse({ content: [{ type: "text", text: "hi" }] });
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY);
      await adapter.chat([{ role: "user", content: "hello" }], MODEL);
    });

    it("should use a custom base URL when provided", async () => {
      globalThis.fetch = mock(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe("http://localhost:8080/v1/messages");
        return jsonResponse({ content: [{ type: "text", text: "hi" }] });
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY, "http://localhost:8080");
      await adapter.chat([{ role: "user", content: "hello" }], MODEL);
    });

    it("should strip trailing slashes from the base URL", async () => {
      globalThis.fetch = mock(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe("http://localhost:8080/v1/messages");
        return jsonResponse({ content: [{ type: "text", text: "hi" }] });
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY, "http://localhost:8080///");
      await adapter.chat([{ role: "user", content: "hello" }], MODEL);
    });
  });

  // ── maxTokens ─────────────────────────────────────────────────────

  describe("maxTokens", () => {
    it("should default to 2048", async () => {
      globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        expect(body.max_tokens).toBe(2048);
        return jsonResponse({ content: [{ type: "text", text: "ok" }] });
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY);
      await adapter.chat([{ role: "user", content: "hello" }], MODEL);
    });

    it("should accept a custom value", async () => {
      globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        expect(body.max_tokens).toBe(4096);
        return jsonResponse({ content: [{ type: "text", text: "ok" }] });
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY, undefined, 4096);
      await adapter.chat([{ role: "user", content: "hello" }], MODEL);
    });
  });

  // ── chat ──────────────────────────────────────────────────────────

  describe("chat", () => {
    it("should send system + user messages correctly", async () => {
      globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        expect(body.model).toBe(MODEL);
        expect(body.system).toBe("You are helpful.");
        expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
        expect(init?.headers).toEqual({
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        });
        return jsonResponse({ content: [{ type: "text", text: "world" }] });
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY);
      const result = await adapter.chat(
        [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "hello" },
        ],
        MODEL,
      );
      expect(result).toBe("world");
    });

    it("should concatenate multiple system messages", async () => {
      globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        expect(body.system).toBe("First system.\n\nSecond system.");
        return jsonResponse({ content: [{ type: "text", text: "ok" }] });
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY);
      await adapter.chat(
        [
          { role: "system", content: "First system." },
          { role: "system", content: "Second system." },
          { role: "user", content: "hi" },
        ],
        MODEL,
      );
    });

    it("should omit the system field when there are no system messages", async () => {
      globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        expect(body.system).toBeUndefined();
        expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
        return jsonResponse({ content: [{ type: "text", text: "world" }] });
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY);
      const result = await adapter.chat([{ role: "user", content: "hello" }], MODEL);
      expect(result).toBe("world");
    });

    it("should throw on API error response", async () => {
      globalThis.fetch = mock(async () => {
        return textResponse("rate limited", 429);
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY);
      await expect(
        adapter.chat([{ role: "user", content: "hello" }], MODEL),
      ).rejects.toThrow("Anthropic API error 429: rate limited");
    });

    it("should return empty string when content blocks are empty", async () => {
      globalThis.fetch = mock(async () => {
        return jsonResponse({ content: [] });
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY);
      const result = await adapter.chat([{ role: "user", content: "hello" }], MODEL);
      expect(result).toBe("");
    });

    it("should return empty string when content is undefined", async () => {
      globalThis.fetch = mock(async () => {
        return jsonResponse({});
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY);
      const result = await adapter.chat([{ role: "user", content: "hello" }], MODEL);
      expect(result).toBe("");
    });

    it("should concatenate multiple text blocks", async () => {
      globalThis.fetch = mock(async () => {
        return jsonResponse({
          content: [
            { type: "text", text: "Hello " },
            { type: "tool_use", id: "x" },
            { type: "text", text: "World" },
          ],
        });
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY);
      const result = await adapter.chat([{ role: "user", content: "hello" }], MODEL);
      expect(result).toBe("Hello World");
    });

    it("should handle text blocks with missing text field", async () => {
      globalThis.fetch = mock(async () => {
        return jsonResponse({
          content: [{ type: "text" }],
        });
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY);
      const result = await adapter.chat([{ role: "user", content: "hello" }], MODEL);
      expect(result).toBe("");
    });
  });

  // ── testConnection ────────────────────────────────────────────────

  describe("testConnection", () => {
    it("should return true when chat succeeds with non-empty response", async () => {
      globalThis.fetch = mock(async () => {
        return jsonResponse({ content: [{ type: "text", text: "OK" }] });
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY);
      const result = await adapter.testConnection(MODEL);
      expect(result).toBe(true);
    });

    it("should return false when chat throws", async () => {
      globalThis.fetch = mock(async () => {
        return textResponse("unauthorized", 401);
      }) as typeof fetch;

      const adapter = new AnthropicAdapter(API_KEY);
      const result = await adapter.testConnection(MODEL);
      expect(result).toBe(false);
    });
  });
});
