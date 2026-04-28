import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AiToolCallService } from "../../application/ai-tool-call/ai-tool-call.service";
import type { AiToolCallRepository } from "../../domain/ai-tool-call/ai-tool-call.repository";
import type { AiToolCall, ToolCallStatus, PermissionLevel } from "../../domain/ai-tool-call/ai-tool-call.entity";

const makeCall = (overrides: Partial<AiToolCall> = {}): AiToolCall => ({
  id: `c-${Math.random()}`,
  conversationId: "conv-1",
  sessionId: null,
  toolName: "get_streak",
  permissionLevel: "auto" as PermissionLevel,
  args: {},
  result: { ok: true },
  errorMessage: null,
  status: "ok" as ToolCallStatus,
  durationMs: 100,
  createdAt: new Date(),
  ...overrides,
});

describe("AiToolCallService", () => {
  let repo: { [K in keyof AiToolCallRepository]: ReturnType<typeof mock> };
  let svc: AiToolCallService;

  beforeEach(() => {
    repo = {
      record: mock(() => Promise.resolve(makeCall())),
      findAll: mock(() => Promise.resolve([])),
    } as unknown as { [K in keyof AiToolCallRepository]: ReturnType<typeof mock> };
    svc = new AiToolCallService(repo as unknown as AiToolCallRepository);
  });

  describe("record", () => {
    it("forwards the input untouched to the repo", async () => {
      await svc.record({
        toolName: "test", permissionLevel: "auto", args: { x: 1 }, status: "ok",
      });
      expect(repo.record).toHaveBeenCalledWith({
        toolName: "test", permissionLevel: "auto", args: { x: 1 }, status: "ok",
      });
    });
  });

  describe("list", () => {
    it("forwards options to findAll", async () => {
      await svc.list({ toolName: "x", limit: 10 });
      expect(repo.findAll).toHaveBeenCalledWith({ toolName: "x", limit: 10 });
    });

    it("can be called with no options", async () => {
      await svc.list();
      expect(repo.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  describe("getStats", () => {
    it("returns zero-state when no records", async () => {
      repo.findAll.mockReturnValue(Promise.resolve([]));
      const stats = await svc.getStats();
      expect(stats.totalCalls).toBe(0);
      expect(stats.byTool).toEqual([]);
      expect(stats.avgDurationMs).toBeNull();
      expect(stats.byStatus).toEqual({ ok: 0, error: 0, denied: 0, invalid_input: 0, rate_limited: 0 });
      expect(stats.recentFailures).toEqual([]);
    });

    it("groups counts per tool, sorted desc", async () => {
      repo.findAll.mockReturnValue(Promise.resolve([
        makeCall({ toolName: "get_streak" }),
        makeCall({ toolName: "get_streak" }),
        makeCall({ toolName: "get_streak" }),
        makeCall({ toolName: "calendar_list" }),
        makeCall({ toolName: "calendar_list" }),
        makeCall({ toolName: "save_memory" }),
      ]));
      const stats = await svc.getStats();
      expect(stats.totalCalls).toBe(6);
      expect(stats.byTool).toEqual([
        { toolName: "get_streak", count: 3 },
        { toolName: "calendar_list", count: 2 },
        { toolName: "save_memory", count: 1 },
      ]);
    });

    it("computes avgDurationMs only for ok calls", async () => {
      repo.findAll.mockReturnValue(Promise.resolve([
        makeCall({ status: "ok", durationMs: 100 }),
        makeCall({ status: "ok", durationMs: 200 }),
        makeCall({ status: "ok", durationMs: 300 }),
        // failures should NOT pollute the average — even with very different durations
        makeCall({ status: "error", durationMs: 5000, errorMessage: "boom" }),
        makeCall({ status: "denied", durationMs: 1, errorMessage: "no" }),
      ]));
      const stats = await svc.getStats();
      expect(stats.avgDurationMs).toBe(200);
    });

    it("ignores ok calls with null durationMs in the average", async () => {
      repo.findAll.mockReturnValue(Promise.resolve([
        makeCall({ status: "ok", durationMs: null }),
        makeCall({ status: "ok", durationMs: 100 }),
      ]));
      const stats = await svc.getStats();
      expect(stats.avgDurationMs).toBe(100);
    });

    it("returns null avgDurationMs when no ok calls", async () => {
      repo.findAll.mockReturnValue(Promise.resolve([
        makeCall({ status: "error", durationMs: 50, errorMessage: "x" }),
      ]));
      const stats = await svc.getStats();
      expect(stats.avgDurationMs).toBeNull();
    });

    it("counts each status correctly", async () => {
      repo.findAll.mockReturnValue(Promise.resolve([
        makeCall({ status: "ok" }),
        makeCall({ status: "ok" }),
        makeCall({ status: "error", errorMessage: "boom" }),
        makeCall({ status: "denied", errorMessage: "no" }),
        makeCall({ status: "rate_limited", errorMessage: "slow down" }),
        makeCall({ status: "invalid_input", errorMessage: "bad zod" }),
      ]));
      const stats = await svc.getStats();
      expect(stats.byStatus).toEqual({ ok: 2, error: 1, denied: 1, invalid_input: 1, rate_limited: 1 });
    });

    it("collects recent failures (status != ok), capped at 20", async () => {
      const records: AiToolCall[] = [];
      // Mix 30 errors, 5 ok — failures should cap at 20 and not include the ok ones.
      for (let i = 0; i < 30; i++) records.push(makeCall({ id: `e${i}`, status: "error", errorMessage: `boom ${i}` }));
      for (let i = 0; i < 5; i++) records.push(makeCall({ id: `ok${i}`, status: "ok" }));
      repo.findAll.mockReturnValue(Promise.resolve(records));

      const stats = await svc.getStats();
      expect(stats.recentFailures).toHaveLength(20);
      expect(stats.recentFailures.every((f) => f.status === "error")).toBe(true);
    });

    it("requests the bounded sample (limit 500) from the repo", async () => {
      repo.findAll.mockReturnValue(Promise.resolve([]));
      await svc.getStats();
      expect(repo.findAll).toHaveBeenCalledWith({ limit: 500 });
    });
  });
});
