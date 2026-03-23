import { describe, it, expect } from "bun:test";
import { BenchService } from "../../application/bench/bench.service";
import type { FunctionBenchConfig, HttpBenchConfig, BenchProgress } from "../../domain/bench/bench.types";

describe("BenchService", () => {
  const service = new BenchService();

  describe("runFunctionBench", () => {
    it("benchmarks a simple expression", async () => {
      const config: FunctionBenchConfig = {
        code: "let x = 0; for (let i = 0; i < 100; i++) x += i;",
        name: "simple-loop",
        iterations: 50,
        warmup: 10,
        timeoutMs: 5000,
      };

      const progress: BenchProgress[] = [];
      const result = await service.runFunctionBench(config, (p) => progress.push(p));

      expect(result.type).toBe("function");
      expect(result.name).toBe("simple-loop");
      expect(result.timing.avg).toBeGreaterThan(0);
      expect(result.timing.min).toBeGreaterThan(0);
      expect(result.timing.max).toBeGreaterThanOrEqual(result.timing.min);
      expect(result.timing.p95).toBeGreaterThanOrEqual(result.timing.p50);
      expect(result.timing.opsPerSec).toBeGreaterThan(0);
      expect(result.memory.heapUsedAvg).toBeGreaterThan(0);
      expect(result.memory.rss).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.startedAt).toBeTruthy();

      // Progress should have warmup + running + done phases
      const phases = new Set(progress.map((p) => p.phase));
      expect(phases.has("done")).toBe(true);
    });

    it("handles async code", async () => {
      const config: FunctionBenchConfig = {
        code: "await new Promise(r => setTimeout(r, 1));",
        name: "async-bench",
        iterations: 5,
        warmup: 2,
        timeoutMs: 5000,
      };

      const result = await service.runFunctionBench(config, () => {});
      expect(result.type).toBe("function");
      expect(result.timing.avg).toBeGreaterThan(0);
    });

    it("rejects invalid code", async () => {
      const config: FunctionBenchConfig = {
        code: "this is not valid javascript {{{}}}",
        name: "bad-code",
        iterations: 10,
        warmup: 0,
        timeoutMs: 1000,
      };

      try {
        await service.runFunctionBench(config, () => {});
        expect(true).toBe(false); // Should not reach
      } catch (e) {
        expect(String(e)).toContain("compilation failed");
      }
    });

    it("respects timeout by stopping iterations early", async () => {
      const config: FunctionBenchConfig = {
        code: "await new Promise(r => setTimeout(r, 10));", // 10ms per iteration
        name: "timeout-test",
        iterations: 10000, // Would take 100s without timeout
        warmup: 0,
        timeoutMs: 200,
      };

      const result = await service.runFunctionBench(config, () => {});

      // Should have stopped well before 10000 iterations
      expect(result.durationMs).toBeLessThan(1000);
      expect(result.timing.samples.length).toBeLessThan(100);
    });
  });

  describe("formatResultAsMarkdown", () => {
    it("formats function result", () => {
      const result = {
        type: "function" as const,
        name: "test-bench",
        config: { code: "x+1", name: "test-bench", iterations: 100, warmup: 10, timeoutMs: 5000 },
        timing: { avg: 2.3, min: 1.1, max: 12.4, p50: 2.0, p95: 4.8, p99: 12.1, opsPerSec: 435, samples: [] },
        memory: { heapUsedAvg: 12, heapUsedPeak: 45, heapTotal: 100, rss: 85 },
        startedAt: "2026-03-23T10:00:00.000Z",
        durationMs: 250,
      };

      const md = service.formatResultAsMarkdown(result);
      expect(md).toContain("# Bench: test-bench");
      expect(md).toContain("| Avg | 2.3ms |");
      expect(md).toContain("| P95 | 4.8ms |");
      expect(md).toContain("| Ops/sec | 435 |");
      expect(md).toContain("| Heap avg | 12MB |");
      expect(md).toContain("```json");
    });

    it("formats HTTP result", () => {
      const result = {
        type: "http" as const,
        url: "http://localhost:47300/api/health",
        method: "GET",
        config: { url: "http://localhost:47300/api/health", method: "GET" as const, concurrency: 10, totalRequests: 100, timeoutMs: 5000 },
        timing: { avg: 5.2, min: 2.1, max: 50.0, p50: 4.0, p95: 15.0, p99: 45.0, opsPerSec: 192, samples: [] },
        throughput: 192,
        errorCount: 2,
        timeoutCount: 1,
        statusCodes: { 200: 97, 500: 3 },
        startedAt: "2026-03-23T10:00:00.000Z",
        durationMs: 520,
      };

      const md = service.formatResultAsMarkdown(result);
      expect(md).toContain("# Bench HTTP:");
      expect(md).toContain("| Throughput | 192 req/s |");
      expect(md).toContain("| Errors | 2 |");
      expect(md).toContain("| Timeouts | 1 |");
      expect(md).toContain("- 200: 97");
      expect(md).toContain("- 500: 3");
    });
  });
});
