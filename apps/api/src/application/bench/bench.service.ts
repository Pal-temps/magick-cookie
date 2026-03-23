import type { BenchLanguageAdapter } from "../../domain/bench/bench-adapter.port";
import type {
  FunctionBenchConfig, HttpBenchConfig,
  FunctionBenchResult, HttpBenchResult, BenchResult,
  BenchProgress, TimingStats,
} from "../../domain/bench/bench.types";
import { BunJsBenchAdapter } from "../../infrastructure/adapters/bench-js.adapter";

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function computeTimingStats(samples: number[]): TimingStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0, opsPerSec: 0, samples: [] };
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  return {
    avg: round(avg), min: round(sorted[0]), max: round(sorted[n - 1]),
    p50: round(sorted[Math.floor(n * 0.5)]),
    p95: round(sorted[Math.floor(n * 0.95)]),
    p99: round(sorted[Math.floor(n * 0.99)]),
    opsPerSec: avg > 0 ? Math.round(1000 / avg) : 0,
    samples: sorted.slice(0, 100),
  };
}

export class BenchService {
  private adapters = new Map<string, BenchLanguageAdapter>();

  constructor() {
    this.adapters.set("javascript", new BunJsBenchAdapter());
  }

  registerAdapter(adapter: BenchLanguageAdapter) {
    this.adapters.set(adapter.language, adapter);
  }

  // ─── Function bench ───

  async runFunctionBench(
    config: FunctionBenchConfig,
    onProgress: (p: BenchProgress) => void,
    language = "javascript",
  ): Promise<FunctionBenchResult> {
    const adapter = this.adapters.get(language);
    if (!adapter) throw new Error(`No adapter for language: ${language}`);
    if (!(await adapter.isAvailable())) throw new Error(`${language} runtime not available`);
    return adapter.runFunctionBench(config, onProgress);
  }

  // ─── HTTP load test ───

  async runHttpBench(
    config: HttpBenchConfig,
    onProgress: (p: BenchProgress) => void,
  ): Promise<HttpBenchResult> {
    const startedAt = new Date().toISOString();
    const wallStart = performance.now();

    // Pre-check URL
    try {
      const check = await fetch(config.url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
      if (!check.ok && check.status >= 500) {
        throw new Error(`Server error: ${check.status}`);
      }
    } catch (e) {
      throw new Error(`URL unreachable: ${config.url} — ${e}`);
    }

    const samples: number[] = [];
    const statusCodes: Record<number, number> = {};
    let errorCount = 0;
    let timeoutCount = 0;
    let completed = 0;

    const total = config.totalRequests ?? Infinity;
    const endTime = config.durationMs ? wallStart + config.durationMs : Infinity;

    const progressInterval = Math.max(1, Math.floor((config.totalRequests ?? 1000) / 20));

    async function worker() {
      while (completed < total && performance.now() < endTime) {
        const idx = completed++;
        if (idx >= total) break;

        const t0 = performance.now();
        try {
          const res = await fetch(config.url, {
            method: config.method,
            headers: config.headers ? { ...config.headers, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
            body: config.method !== "GET" ? config.body : undefined,
            signal: AbortSignal.timeout(config.timeoutMs),
          });
          const t1 = performance.now();
          samples.push(t1 - t0);
          statusCodes[res.status] = (statusCodes[res.status] ?? 0) + 1;
        } catch (e) {
          const t1 = performance.now();
          samples.push(t1 - t0);
          if (String(e).includes("timeout") || String(e).includes("abort")) {
            timeoutCount++;
          } else {
            errorCount++;
          }
        }

        if (idx % progressInterval === 0) {
          onProgress({ phase: "running", current: idx, total: config.totalRequests ?? idx, elapsed: performance.now() - wallStart });
        }
      }
    }

    // Launch concurrent workers
    const workers = Array.from({ length: config.concurrency }, () => worker());
    await Promise.all(workers);

    const wallEnd = performance.now();
    const durationMs = round(wallEnd - wallStart);
    const timing = computeTimingStats(samples);
    const throughput = round(samples.length / (durationMs / 1000));

    onProgress({ phase: "done", current: samples.length, total: samples.length, elapsed: durationMs });

    return {
      type: "http",
      url: config.url,
      method: config.method,
      config,
      timing,
      throughput,
      errorCount,
      timeoutCount,
      statusCodes,
      startedAt,
      durationMs,
    };
  }

  // ─── Markdown ───

  formatResultAsMarkdown(result: BenchResult): string {
    const date = new Date(result.startedAt).toLocaleString("fr-FR");
    const lines: string[] = [];

    if (result.type === "function") {
      lines.push(`# Bench: ${result.name} — ${date}`);
      lines.push("");
      lines.push("## Config");
      lines.push(`- Type: function`);
      lines.push(`- Iterations: ${result.config.iterations}, Warmup: ${result.config.warmup}, Timeout: ${result.config.timeoutMs}ms`);
      lines.push(`- Duree totale: ${result.durationMs}ms`);
      lines.push("");
      lines.push("## Performance");
      lines.push("| Metrique | Valeur |");
      lines.push("|----------|--------|");
      lines.push(`| Avg | ${result.timing.avg}ms |`);
      lines.push(`| Min | ${result.timing.min}ms |`);
      lines.push(`| Max | ${result.timing.max}ms |`);
      lines.push(`| P50 | ${result.timing.p50}ms |`);
      lines.push(`| P95 | ${result.timing.p95}ms |`);
      lines.push(`| P99 | ${result.timing.p99}ms |`);
      lines.push(`| Ops/sec | ${result.timing.opsPerSec} |`);
      lines.push("");
      lines.push("## Memoire");
      lines.push("| Metrique | Valeur |");
      lines.push("|----------|--------|");
      lines.push(`| Heap avg | ${result.memory.heapUsedAvg}MB |`);
      lines.push(`| Heap peak | ${result.memory.heapUsedPeak}MB |`);
      lines.push(`| Heap total | ${result.memory.heapTotal}MB |`);
      lines.push(`| RSS | ${result.memory.rss}MB |`);
    } else {
      lines.push(`# Bench HTTP: ${result.method} ${result.url} — ${date}`);
      lines.push("");
      lines.push("## Config");
      lines.push(`- Type: http`);
      lines.push(`- Concurrency: ${result.config.concurrency}, Timeout: ${result.config.timeoutMs}ms`);
      if (result.config.totalRequests) lines.push(`- Total requests: ${result.config.totalRequests}`);
      if (result.config.durationMs) lines.push(`- Duration: ${result.config.durationMs}ms`);
      lines.push(`- Duree totale: ${result.durationMs}ms`);
      lines.push("");
      lines.push("## Performance");
      lines.push("| Metrique | Valeur |");
      lines.push("|----------|--------|");
      lines.push(`| Throughput | ${result.throughput} req/s |`);
      lines.push(`| Avg latency | ${result.timing.avg}ms |`);
      lines.push(`| P50 | ${result.timing.p50}ms |`);
      lines.push(`| P95 | ${result.timing.p95}ms |`);
      lines.push(`| P99 | ${result.timing.p99}ms |`);
      lines.push(`| Errors | ${result.errorCount} |`);
      lines.push(`| Timeouts | ${result.timeoutCount} |`);
      lines.push("");
      lines.push("## Status codes");
      for (const [code, count] of Object.entries(result.statusCodes)) {
        lines.push(`- ${code}: ${count}`);
      }
    }

    lines.push("");
    lines.push("## Raw");
    lines.push("```json");
    lines.push(JSON.stringify(result, null, 2));
    lines.push("```");

    return lines.join("\n");
  }
}
