// ─── Config ───

export interface FunctionBenchConfig {
  code: string;
  name: string;
  iterations: number;
  warmup: number;
  timeoutMs: number;
}

export interface HttpBenchConfig {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  concurrency: number;
  durationMs?: number;
  totalRequests?: number;
  timeoutMs: number;
}

// ─── Stats ───

export interface TimingStats {
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  opsPerSec: number;
  samples: number[];
}

export interface MemoryStats {
  heapUsedAvg: number;
  heapUsedPeak: number;
  heapTotal: number;
  rss: number;
}

// ─── Results ───

export interface FunctionBenchResult {
  type: "function";
  name: string;
  config: FunctionBenchConfig;
  timing: TimingStats;
  memory: MemoryStats;
  startedAt: string;
  durationMs: number;
}

export interface HttpBenchResult {
  type: "http";
  url: string;
  method: string;
  config: HttpBenchConfig;
  timing: TimingStats;
  throughput: number;
  errorCount: number;
  timeoutCount: number;
  statusCodes: Record<number, number>;
  startedAt: string;
  durationMs: number;
}

export type BenchResult = FunctionBenchResult | HttpBenchResult;

// ─── Progress (SSE) ───

export interface BenchProgress {
  phase: "warmup" | "running" | "done" | "error";
  current: number;
  total: number;
  elapsed: number;
  error?: string;
}
