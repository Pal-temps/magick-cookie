import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

// ─── Types (mirror API bench.types.ts) ───

export interface TimingStats {
  avg: number; min: number; max: number; p50: number; p95: number; p99: number; opsPerSec: number;
}

export interface MemoryStats {
  heapUsedAvg: number; heapUsedPeak: number; heapTotal: number; rss: number;
}

export interface FunctionBenchResult {
  type: "function"; name: string;
  config: { code: string; name: string; iterations: number; warmup: number; timeoutMs: number };
  timing: TimingStats; memory: MemoryStats; startedAt: string; durationMs: number;
}

export interface HttpBenchResult {
  type: "http"; url: string; method: string;
  config: { url: string; method: string; concurrency: number; totalRequests?: number; durationMs?: number; timeoutMs: number };
  timing: TimingStats; throughput: number; errorCount: number; timeoutCount: number;
  statusCodes: Record<number, number>; startedAt: string; durationMs: number;
}

export type BenchResult = FunctionBenchResult | HttpBenchResult;

export interface BenchProgress {
  phase: "warmup" | "running" | "done" | "error";
  current: number; total: number; elapsed: number; error?: string;
}

export interface BenchHistoryEntry {
  path: string; name: string; date: string; type: "function" | "http"; keyMetric: string;
}

export interface BenchDelta {
  field: string; current: number; previous: number; delta: number; better: boolean;
}

// ─── State ───

const [benchTab, setBenchTab] = createSignal<"function" | "http" | "history">("function");
const [isRunning, setIsRunning] = createSignal(false);
const [progress, setProgress] = createSignal<BenchProgress | null>(null);
const [currentResult, setCurrentResult] = createSignal<BenchResult | null>(null);
const [previousResult, setPreviousResult] = createSignal<BenchResult | null>(null);
const [history, setHistory] = createSignal<BenchHistoryEntry[]>([]);
const [error, setError] = createSignal<string | null>(null);

// Function config
const [fnCode, setFnCode] = createSignal("let sum = 0; for (let i = 0; i < 1000; i++) sum += Math.random();");
const [fnName, setFnName] = createSignal("example-bench");
const [fnIterations, setFnIterations] = createSignal(1000);
const [fnWarmup, setFnWarmup] = createSignal(100);
const [fnTimeout, setFnTimeout] = createSignal(10000);

// HTTP config
const [httpUrl, setHttpUrl] = createSignal("http://localhost:47300/api/health");
const [httpMethod, setHttpMethod] = createSignal("GET");
const [httpBody, setHttpBody] = createSignal("");
const [httpConcurrency, setHttpConcurrency] = createSignal(10);
const [httpTotalRequests, setHttpTotalRequests] = createSignal(100);
const [httpTimeout, setHttpTimeout] = createSignal(5000);

const API_BASE = "http://localhost:47300/api";

// ─── SSE parser ───

function parseSSEBuffer(buffer: string): { events: { event: string; data: string }[]; remaining: string } {
  const events: { event: string; data: string }[] = [];
  const parts = buffer.split("\n\n");
  const remaining = parts.pop() ?? "";

  for (const part of parts) {
    let event = "message";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7);
      else if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (data) events.push({ event, data });
  }

  return { events, remaining };
}

// ─── Store ───

export function useBenchStore() {

  async function runFunctionBench() {
    setIsRunning(true);
    setProgress(null);
    setCurrentResult(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/bench/run/function`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: fnCode(), name: fnName(),
          iterations: fnIterations(), warmup: fnWarmup(), timeoutMs: fnTimeout(),
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, remaining } = parseSSEBuffer(buffer);
        buffer = remaining;

        for (const ev of events) {
          if (ev.event === "progress") setProgress(JSON.parse(ev.data));
          else if (ev.event === "result") {
            const result = JSON.parse(ev.data) as FunctionBenchResult;
            setCurrentResult(result);
            await saveResult(result);
            await loadPreviousResult(result.name, result.startedAt);
          }
          else if (ev.event === "error") setError(ev.data);
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setIsRunning(false);
    }
  }

  async function runHttpBench() {
    setIsRunning(true);
    setProgress(null);
    setCurrentResult(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/bench/run/http`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: httpUrl(), method: httpMethod(), body: httpBody() || undefined,
          concurrency: httpConcurrency(), totalRequests: httpTotalRequests(),
          timeoutMs: httpTimeout(),
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, remaining } = parseSSEBuffer(buffer);
        buffer = remaining;

        for (const ev of events) {
          if (ev.event === "progress") setProgress(JSON.parse(ev.data));
          else if (ev.event === "result") {
            const result = JSON.parse(ev.data) as HttpBenchResult;
            setCurrentResult(result);
            await saveResult(result);
          }
          else if (ev.event === "error") setError(ev.data);
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setIsRunning(false);
    }
  }

  async function saveResult(result: BenchResult) {
    try {
      // Get markdown from API
      const res = await fetch(`${API_BASE}/bench/format`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      const { data } = await res.json() as { data: { markdown: string } };

      const slug = (result.type === "function" ? result.name : `http-${result.method}-${new URL(result.url).pathname.replace(/\//g, "-")}`)
        .replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase().replace(/-+/g, "-");
      const dateStr = new Date(result.startedAt).toISOString().slice(0, 19).replace(/[T:]/g, "-");
      const path = `_benchmarks/bench-${slug}-${dateStr}.md`;

      await invoke("notes_save", { path, content: data.markdown });
    } catch (e) {
      console.error("Failed to save bench result:", e);
    }
  }

  async function loadHistory() {
    try {
      const files = await invoke<{ name: string; path: string; modified: number }[]>("notes_list");
      const benchFiles = files
        .filter((f) => f.path.startsWith("_benchmarks/bench-"))
        .sort((a, b) => b.modified - a.modified);

      const entries: BenchHistoryEntry[] = [];
      for (const f of benchFiles.slice(0, 50)) {
        try {
          const content = await invoke<string>("notes_read", { path: f.path });
          const firstLine = content.split("\n")[0] ?? "";
          const nameMatch = firstLine.match(/^# Bench(?:\sHTTP)?:\s*(.+?)\s*—/);
          const name = nameMatch?.[1] ?? f.name;
          const isHttp = firstLine.includes("HTTP");
          const avgMatch = content.match(/\| Avg(?:\slatency)?\s*\|\s*([\d.]+)ms/);
          const tpMatch = content.match(/\| Throughput\s*\|\s*([\d.]+)/);
          const keyMetric = isHttp ? `${tpMatch?.[1] ?? "?"} req/s` : `${avgMatch?.[1] ?? "?"}ms avg`;

          entries.push({
            path: f.path, name, type: isHttp ? "http" : "function", keyMetric,
            date: new Date(f.modified * 1000).toLocaleDateString("fr-FR"),
          });
        } catch {}
      }
      setHistory(entries);
    } catch (e) {
      console.error("Failed to load bench history:", e);
    }
  }

  async function loadPreviousResult(name: string, currentStartedAt: string) {
    // Find the most recent bench with same name but different date
    try {
      const files = await invoke<{ name: string; path: string; modified: number }[]>("notes_list");
      const slug = name.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase().replace(/-+/g, "-");
      const matching = files
        .filter((f) => f.path.startsWith(`_benchmarks/bench-${slug}-`) && !f.path.includes(currentStartedAt.slice(0, 10)))
        .sort((a, b) => b.modified - a.modified);

      if (matching.length === 0) { setPreviousResult(null); return; }

      const content = await invoke<string>("notes_read", { path: matching[0].path });
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        setPreviousResult(JSON.parse(jsonMatch[1]) as BenchResult);
      }
    } catch {
      setPreviousResult(null);
    }
  }

  function computeDeltas(current: BenchResult, previous: BenchResult): BenchDelta[] {
    const deltas: BenchDelta[] = [];
    const ct = current.timing;
    const pt = previous.timing;

    function add(field: string, c: number, p: number, lowerIsBetter: boolean) {
      if (p === 0) return;
      const delta = Math.round(((c - p) / p) * 100);
      deltas.push({ field, current: c, previous: p, delta, better: lowerIsBetter ? delta < 0 : delta > 0 });
    }

    add("Avg", ct.avg, pt.avg, true);
    add("P95", ct.p95, pt.p95, true);
    add("P99", ct.p99, pt.p99, true);
    add("Ops/sec", ct.opsPerSec, pt.opsPerSec, false);

    if (current.type === "function" && previous.type === "function") {
      add("Heap avg", current.memory.heapUsedAvg, previous.memory.heapUsedAvg, true);
      add("RSS", current.memory.rss, previous.memory.rss, true);
    }
    if (current.type === "http" && previous.type === "http") {
      add("Throughput", current.throughput, previous.throughput, false);
      add("Errors", current.errorCount, previous.errorCount, true);
    }

    return deltas;
  }

  return {
    // State
    benchTab, setBenchTab, isRunning, progress, currentResult, previousResult, history, error,
    // Function config
    fnCode, setFnCode, fnName, setFnName, fnIterations, setFnIterations, fnWarmup, setFnWarmup, fnTimeout, setFnTimeout,
    // HTTP config
    httpUrl, setHttpUrl, httpMethod, setHttpMethod, httpBody, setHttpBody,
    httpConcurrency, setHttpConcurrency, httpTotalRequests, setHttpTotalRequests, httpTimeout, setHttpTimeout,
    // Actions
    runFunctionBench, runHttpBench, loadHistory, computeDeltas,
  };
}
