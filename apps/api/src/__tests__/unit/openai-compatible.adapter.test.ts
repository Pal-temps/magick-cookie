import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { OpenAICompatibleAdapter } from "../../infrastructure/adapters/openai-compatible.adapter";

const BASE_URL = "http://localhost:1234";
const API_KEY = "sk-test-key";
const MODEL = "gpt-4o-mini";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

describe("OpenAICompatibleAdapter", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── chat ──────────────────────────────────────────────────────────

  describe("chat", () => {
    it("should return the message content on success", async () => {
      globalThis.fetch = mock(async () => {
        return jsonResponse({
          choices: [{ message: { content: "Hello world" } }],
        });
      }) as typeof fetch;

      const adapter = new OpenAICompatibleAdapter(BASE_URL, API_KEY);
      const result = await adapter.chat(
        [{ role: "user", content: "hello" }],
        MODEL,
      );
      expect(result).toBe("Hello world");
    });

    it("should send correct URL, method, and body", async () => {
      globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(`${BASE_URL}/v1/chat/completions`);
        expect(init?.method).toBe("POST");
        const body = JSON.parse(init?.body as string);
        expect(body.model).toBe(MODEL);
        expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
        return jsonResponse({
          choices: [{ message: { content: "ok" } }],
        });
      }) as typeof fetch;

      const adapter = new OpenAICompatibleAdapter(BASE_URL, API_KEY);
      await adapter.chat([{ role: "user", content: "hello" }], MODEL);
    });

    it("should include Authorization header when apiKey is provided", async () => {
      globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>;
        expect(headers["Authorization"]).toBe(`Bearer ${API_KEY}`);
        return jsonResponse({
          choices: [{ message: { content: "ok" } }],
        });
      }) as typeof fetch;

      const adapter = new OpenAICompatibleAdapter(BASE_URL, API_KEY);
      await adapter.chat([{ role: "user", content: "hello" }], MODEL);
    });

    it("should not include Authorization header when apiKey is null", async () => {
      globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>;
        expect(headers["Authorization"]).toBeUndefined();
        return jsonResponse({
          choices: [{ message: { content: "ok" } }],
        });
      }) as typeof fetch;

      const adapter = new OpenAICompatibleAdapter(BASE_URL, null);
      await adapter.chat([{ role: "user", content: "hello" }], MODEL);
    });

    it("should not include Authorization header when apiKey is omitted", async () => {
      globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>;
        expect(headers["Authorization"]).toBeUndefined();
        return jsonResponse({
          choices: [{ message: { content: "ok" } }],
        });
      }) as typeof fetch;

      const adapter = new OpenAICompatibleAdapter(BASE_URL);
      await adapter.chat([{ role: "user", content: "hello" }], MODEL);
    });

    it("should throw on API error response", async () => {
      globalThis.fetch = mock(async () => {
        return textResponse("rate limited", 429);
      }) as typeof fetch;

      const adapter = new OpenAICompatibleAdapter(BASE_URL, API_KEY);
      await expect(
        adapter.chat([{ role: "user", content: "hello" }], MODEL),
      ).rejects.toThrow("LLM API error 429: rate limited");
    });

    it("should return empty string when choices array is empty", async () => {
      globalThis.fetch = mock(async () => {
        return jsonResponse({ choices: [] });
      }) as typeof fetch;

      const adapter = new OpenAICompatibleAdapter(BASE_URL, API_KEY);
      const result = await adapter.chat(
        [{ role: "user", content: "hello" }],
        MODEL,
      );
      expect(result).toBe("");
    });

    it("should return empty string when choices is undefined", async () => {
      globalThis.fetch = mock(async () => {
        return jsonResponse({});
      }) as typeof fetch;

      const adapter = new OpenAICompatibleAdapter(BASE_URL, API_KEY);
      const result = await adapter.chat(
        [{ role: "user", content: "hello" }],
        MODEL,
      );
      expect(result).toBe("");
    });
  });

  // ── testConnection ────────────────────────────────────────────────

  describe("testConnection", () => {
    it("should return true when chat succeeds with non-empty response", async () => {
      globalThis.fetch = mock(async () => {
        return jsonResponse({
          choices: [{ message: { content: "OK" } }],
        });
      }) as typeof fetch;

      const adapter = new OpenAICompatibleAdapter(BASE_URL, API_KEY);
      const result = await adapter.testConnection(MODEL);
      expect(result).toBe(true);
    });

    it("should return false when chat throws", async () => {
      globalThis.fetch = mock(async () => {
        return textResponse("unauthorized", 401);
      }) as typeof fetch;

      const adapter = new OpenAICompatibleAdapter(BASE_URL, API_KEY);
      const result = await adapter.testConnection(MODEL);
      expect(result).toBe(false);
    });
  });
});
