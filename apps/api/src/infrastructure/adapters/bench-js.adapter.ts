import type { BenchLanguageAdapter } from "../../domain/bench/bench-adapter.port";
import type { FunctionBenchConfig, FunctionBenchResult, BenchProgress, TimingStats, MemoryStats } from "../../domain/bench/bench.types";

function computeTimingStats(samples: number[]): TimingStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0, opsPerSec: 0, samples: [] };

  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / n;

  return {
    avg: round(avg),
    min: round(sorted[0]),
    max: round(sorted[n - 1]),
    p50: round(sorted[Math.floor(n * 0.5)]),
    p95: round(sorted[Math.floor(n * 0.95)]),
    p99: round(sorted[Math.floor(n * 0.99)]),
    opsPerSec: avg > 0 ? Math.round(1000 / avg) : 0,
    samples: sorted,
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function bytesToMB(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

export class BunJsBenchAdapter implements BenchLanguageAdapter {
  language = "javascript";

  async isAvailable(): Promise<boolean> {
    return true; // Bun is always available (we are running in Bun)
  }

  async runFunctionBench(
    config: FunctionBenchConfig,
    onProgress: (p: BenchProgress) => void,
  ): Promise<FunctionBenchResult> {
    const startedAt = new Date().toISOString();
    const wallStart = performance.now();

    // Compile the user code
    let fn: () => unknown;
    try {
      // Wrap in async IIFE to support both sync and async code
      fn = new Function(`return (async () => { ${config.code} })()`) as () => unknown;
    } catch (e) {
      throw new Error(`Code compilation failed: ${e}`);
    }

    const total = config.warmup + config.iterations;
    const progressInterval = Math.max(1, Math.floor(total / 20)); // Report ~20 times

    // ─── Warmup ───
    for (let i = 0; i < config.warmup; i++) {
      await fn();
      if (i % progressInterval === 0) {
        onProgress({ phase: "warmup", current: i, total, elapsed: performance.now() - wallStart });
      }
    }

    // ─── Measurement ───
    const samples: number[] = [];
    const heapSamples: number[] = [];
    let heapPeak = 0;
    let lastHeapTotal = 0;
    let lastRss = 0;

    for (let i = 0; i < config.iterations; i++) {
      // Check timeout
      if (performance.now() - wallStart > config.timeoutMs) {
        onProgress({ phase: "error", current: i, total, elapsed: performance.now() - wallStart, error: "Timeout" });
        break;
      }

      const memBefore = process.memoryUsage();
      const t0 = performance.now();
      await fn();
      const t1 = performance.now();
      const memAfter = process.memoryUsage();

      samples.push(t1 - t0);
      heapSamples.push(memAfter.heapUsed);
      if (memAfter.heapUsed > heapPeak) heapPeak = memAfter.heapUsed;
      lastHeapTotal = memAfter.heapTotal;
      lastRss = memAfter.rss;

      if ((config.warmup + i) % progressInterval === 0) {
        onProgress({ phase: "running", current: config.warmup + i, total, elapsed: performance.now() - wallStart });
      }
    }

    const wallEnd = performance.now();
    const durationMs = round(wallEnd - wallStart);

    // Compute stats
    const timing = computeTimingStats(samples);

    const heapUsedAvg = heapSamples.length > 0
      ? heapSamples.reduce((a, b) => a + b, 0) / heapSamples.length
      : 0;

    const memory: MemoryStats = {
      heapUsedAvg: bytesToMB(heapUsedAvg),
      heapUsedPeak: bytesToMB(heapPeak),
      heapTotal: bytesToMB(lastHeapTotal),
      rss: bytesToMB(lastRss),
    };

    // Strip raw samples for storage (keep only first 100 for sparkline)
    timing.samples = timing.samples.slice(0, 100);

    onProgress({ phase: "done", current: total, total, elapsed: durationMs });

    return {
      type: "function",
      name: config.name,
      config,
      timing,
      memory,
      startedAt,
      durationMs,
    };
  }
}
