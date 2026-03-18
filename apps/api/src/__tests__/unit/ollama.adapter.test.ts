import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { OllamaAdapter } from "../../infrastructure/adapters/ollama.adapter";

const BASE_URL = "http://localhost:11434";
const MODEL = "llama3";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

describe("OllamaAdapter", () => {
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
        return jsonResponse({ message: { content: "Hello world" } });
      }) as typeof fetch;

      const adapter = new OllamaAdapter(BASE_URL);
      const result = await adapter.chat(
        [{ role: "user", content: "hello" }],
        MODEL,
      );
      expect(result).toBe("Hello world");
    });

    it("should send correct URL, method, and body", async () => {
      globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(`${BASE_URL}/api/chat`);
        expect(init?.method).toBe("POST");
        const body = JSON.parse(init?.body as string);
        expect(body.model).toBe(MODEL);
        expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
        expect(body.stream).toBe(false);
        return jsonResponse({ message: { content: "ok" } });
      }) as typeof fetch;

      const adapter = new OllamaAdapter(BASE_URL);
      await adapter.chat([{ role: "user", content: "hello" }], MODEL);
    });

    it("should throw on API error response", async () => {
      globalThis.fetch = mock(async () => {
        return textResponse("model not found", 404);
      }) as typeof fetch;

      const adapter = new OllamaAdapter(BASE_URL);
      await expect(
        adapter.chat([{ role: "user", content: "hello" }], MODEL),
      ).rejects.toThrow("Ollama error 404: model not found");
    });

    it("should return empty string when message.content is missing", async () => {
      globalThis.fetch = mock(async () => {
        return jsonResponse({});
      }) as typeof fetch;

      const adapter = new OllamaAdapter(BASE_URL);
      const result = await adapter.chat(
        [{ role: "user", content: "hello" }],
        MODEL,
      );
      expect(result).toBe("");
    });

    it("should return empty string when message exists but content is undefined", async () => {
      globalThis.fetch = mock(async () => {
        return jsonResponse({ message: {} });
      }) as typeof fetch;

      const adapter = new OllamaAdapter(BASE_URL);
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
        return jsonResponse({ message: { content: "OK" } });
      }) as typeof fetch;

      const adapter = new OllamaAdapter(BASE_URL);
      const result = await adapter.testConnection(MODEL);
      expect(result).toBe(true);
    });

    it("should return false when chat throws", async () => {
      globalThis.fetch = mock(async () => {
        return textResponse("connection refused", 500);
      }) as typeof fetch;

      const adapter = new OllamaAdapter(BASE_URL);
      const result = await adapter.testConnection(MODEL);
      expect(result).toBe(false);
    });
  });
});
