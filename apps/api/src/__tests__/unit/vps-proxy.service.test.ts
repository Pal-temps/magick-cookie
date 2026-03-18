import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { VpsProxyService } from "../../application/vps/vps-proxy.service";

describe("VpsProxyService", () => {
  let service: VpsProxyService;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    service = new VpsProxyService("https://vps.example.com", "test-token-123");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("proxy", () => {
    test("makes GET request with auth headers by default", async () => {
      const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as any;

      const result = await service.proxy("/api/data");

      expect(result).toBe(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe("https://vps.example.com/api/data");
      expect(options.method).toBe("GET");
      expect(options.headers.Authorization).toBe("Bearer test-token-123");
      expect(options.headers["Content-Type"]).toBe("application/json");
    });

    test("uses specified HTTP method", async () => {
      const mockResponse = new Response("", { status: 204 });
      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as any;

      await service.proxy("/api/data", { method: "POST" });

      const [, options] = (globalThis.fetch as any).mock.calls[0];
      expect(options.method).toBe("POST");
    });

    test("appends query parameters to URL", async () => {
      const mockResponse = new Response("", { status: 200 });
      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as any;

      await service.proxy("/api/data", { query: { page: "2", limit: "10" } });

      const [url] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toContain("page=2");
      expect(url).toContain("limit=10");
    });

    test("skips falsy query parameter values", async () => {
      const mockResponse = new Response("", { status: 200 });
      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as any;

      await service.proxy("/api/data", { query: { page: "1", filter: "" } });

      const [url] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toContain("page=1");
      expect(url).not.toContain("filter");
    });

    test("works without options", async () => {
      const mockResponse = new Response("ok", { status: 200 });
      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as any;

      const result = await service.proxy("/api/health");

      expect(result).toBe(mockResponse);
      const [url, options] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe("https://vps.example.com/api/health");
      expect(options.method).toBe("GET");
    });

    test("propagates fetch errors", async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error("Network error"))) as any;

      await expect(service.proxy("/api/data")).rejects.toThrow("Network error");
    });
  });

  describe("streamProxy", () => {
    test("makes request with auth header and returns body", async () => {
      const mockBody = new ReadableStream();
      const mockResponse = new Response(mockBody, { status: 200 });
      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as any;

      const result = await service.streamProxy("/api/stream");

      expect(result).toBeDefined();
      const [url, options] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe("https://vps.example.com/api/stream");
      expect(options.headers.Authorization).toBe("Bearer test-token-123");
    });

    test("appends query parameters", async () => {
      const mockResponse = new Response(new ReadableStream(), { status: 200 });
      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as any;

      await service.streamProxy("/api/stream", { since: "2026-01-01" });

      const [url] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toContain("since=2026-01-01");
    });

    test("skips falsy query values", async () => {
      const mockResponse = new Response(new ReadableStream(), { status: 200 });
      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as any;

      await service.streamProxy("/api/stream", { key: "val", empty: "" });

      const [url] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toContain("key=val");
      expect(url).not.toContain("empty");
    });

    test("works without query parameter", async () => {
      const mockResponse = new Response(new ReadableStream(), { status: 200 });
      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as any;

      await service.streamProxy("/api/stream");

      const [url] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe("https://vps.example.com/api/stream");
    });

    test("returns null when response has no body", async () => {
      const mockResponse = { body: null } as Response;
      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as any;

      const result = await service.streamProxy("/api/stream");

      expect(result).toBeNull();
    });

    test("propagates fetch errors", async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error("Connection refused"))) as any;

      await expect(service.streamProxy("/api/stream")).rejects.toThrow("Connection refused");
    });
  });
});
