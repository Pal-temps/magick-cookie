import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock the apiClient before importing the service so the import sees the stub.
const apiGetMock = mock(async (_path: string) => undefined as unknown);
mock.module("../../infrastructure/api/apiClient", () => ({
  api: {
    get: apiGetMock,
    getRaw: mock(async () => undefined),
    post: mock(async () => undefined),
    put: mock(async () => undefined),
    patch: mock(async () => undefined),
    delete: mock(async () => undefined),
  },
}));

import { aiActivityService, type AiToolCall, type AiActivityStats } from "../../application/services/aiActivityService";

beforeEach(() => {
  apiGetMock.mockClear();
});

describe("aiActivityService", () => {
  describe("list", () => {
    test("calls /api/ai/tool-calls with no query when no params", async () => {
      apiGetMock.mockImplementationOnce(async () => [] as AiToolCall[]);
      await aiActivityService.list();
      expect(apiGetMock).toHaveBeenCalledWith("/api/ai/tool-calls");
    });

    test("appends a single param", async () => {
      apiGetMock.mockImplementationOnce(async () => [] as AiToolCall[]);
      await aiActivityService.list({ status: "ok" });
      expect(apiGetMock).toHaveBeenCalledWith("/api/ai/tool-calls?status=ok");
    });

    test("appends multiple params and url-encodes", async () => {
      apiGetMock.mockImplementationOnce(async () => [] as AiToolCall[]);
      await aiActivityService.list({ toolName: "get streak", limit: 10, status: "error" });
      const path = apiGetMock.mock.calls[0][0] as string;
      // Order isn't guaranteed in Object.entries — assert presence + encoding instead.
      expect(path).toStartWith("/api/ai/tool-calls?");
      expect(path).toContain("toolName=get%20streak");
      expect(path).toContain("limit=10");
      expect(path).toContain("status=error");
    });

    test("skips undefined values", async () => {
      apiGetMock.mockImplementationOnce(async () => [] as AiToolCall[]);
      await aiActivityService.list({ toolName: "x", limit: undefined });
      const path = apiGetMock.mock.calls[0][0] as string;
      expect(path).toBe("/api/ai/tool-calls?toolName=x");
    });

    test("returns the parsed AiToolCall[]", async () => {
      const sample: AiToolCall[] = [
        {
          id: "c-1", conversationId: "conv-1", sessionId: null, toolName: "get_streak",
          permissionLevel: "auto", args: {}, result: { streak: 7 }, errorMessage: null,
          status: "ok", durationMs: 42, createdAt: "2026-04-28T10:00:00Z",
        },
      ];
      apiGetMock.mockImplementationOnce(async () => sample);
      const out = await aiActivityService.list();
      expect(out).toEqual(sample);
    });
  });

  describe("getStats", () => {
    test("calls /api/ai/tool-calls/stats", async () => {
      apiGetMock.mockImplementationOnce(async () => ({
        totalCalls: 0, byTool: [], byStatus: { ok: 0, error: 0, denied: 0, invalid_input: 0, rate_limited: 0 }, avgDurationMs: null, recentFailures: [],
      } as AiActivityStats));
      await aiActivityService.getStats();
      expect(apiGetMock).toHaveBeenCalledWith("/api/ai/tool-calls/stats");
    });
  });
});
