import { Show, For } from "solid-js";
import type { BenchResult, BenchDelta, FunctionBenchResult, HttpBenchResult } from "../../../application/stores/benchStore";

function fmt(n: number, decimals = 2): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toFixed(decimals);
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return (bytes / 1_073_741_824).toFixed(1) + " GB";
  if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
  return bytes + " B";
}

const tableStyle = {
  width: "100%",
  "border-collapse": "collapse" as const,
  "font-size": "12px",
  "margin-bottom": "12px",
};

const thStyle = {
  "text-align": "left" as const,
  padding: "6px 10px",
  "font-weight": "600",
  color: "var(--text-secondary)",
  "border-bottom": "1px solid var(--border-color)",
  "font-size": "11px",
  "text-transform": "uppercase" as const,
  "letter-spacing": "0.3px",
};

const tdStyle = {
  padding: "6px 10px",
  color: "var(--text-primary)",
  "border-bottom": "1px solid var(--border-color)",
};

function DeltaBadge(props: { field: string; deltas?: BenchDelta[] }) {
  const delta = () => props.deltas?.find((d) => d.field === props.field);
  return (
    <Show when={delta()}>
      {(d) => (
        <span style={{
          "margin-left": "6px",
          "font-size": "10px",
          "font-weight": "600",
          color: d().better ? "var(--success)" : "var(--danger)",
        }}>
          {d().delta > 0 ? "\u25B2" : "\u25BC"} {Math.abs(d().delta)}%
        </span>
      )}
    </Show>
  );
}

export function BenchResultCard(props: { result: BenchResult; deltas?: BenchDelta[] }) {
  const isFn = () => props.result.type === "function";
  const fnResult = () => props.result as FunctionBenchResult;
  const httpResult = () => props.result as HttpBenchResult;
  const t = () => props.result.timing;

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-color)",
      "border-radius": "var(--radius-md)",
      padding: "14px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        "margin-bottom": "12px",
      }}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <span style={{
            padding: "2px 8px",
            "border-radius": "var(--radius-sm)",
            background: isFn() ? "rgba(99, 102, 241, 0.15)" : "rgba(16, 185, 129, 0.15)",
            color: isFn() ? "#6366f1" : "#10b981",
            "font-size": "11px",
            "font-weight": "600",
          }}>
            {isFn() ? "Function" : "HTTP"}
          </span>
          <span style={{ "font-size": "13px", "font-weight": "600", color: "var(--text-primary)" }}>
            {isFn() ? fnResult().name : `${httpResult().method} ${httpResult().url}`}
          </span>
        </div>
        <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
          {fmt(props.result.durationMs, 0)}ms total
        </span>
      </div>

      {/* Timing table */}
      <div style={{ "font-size": "11px", "font-weight": "600", color: "var(--text-secondary)", "margin-bottom": "6px" }}>
        Timing
      </div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Metric</th>
            <th style={thStyle}>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}>Avg</td>
            <td style={tdStyle}>{fmt(t().avg)}ms <DeltaBadge field="Avg" deltas={props.deltas} /></td>
          </tr>
          <tr>
            <td style={tdStyle}>Min</td>
            <td style={tdStyle}>{fmt(t().min)}ms</td>
          </tr>
          <tr>
            <td style={tdStyle}>Max</td>
            <td style={tdStyle}>{fmt(t().max)}ms</td>
          </tr>
          <tr>
            <td style={tdStyle}>P50</td>
            <td style={tdStyle}>{fmt(t().p50)}ms</td>
          </tr>
          <tr>
            <td style={tdStyle}>P95</td>
            <td style={tdStyle}>{fmt(t().p95)}ms <DeltaBadge field="P95" deltas={props.deltas} /></td>
          </tr>
          <tr>
            <td style={tdStyle}>P99</td>
            <td style={tdStyle}>{fmt(t().p99)}ms <DeltaBadge field="P99" deltas={props.deltas} /></td>
          </tr>
          <tr>
            <td style={tdStyle}>Ops/sec</td>
            <td style={tdStyle}>{fmt(t().opsPerSec, 0)} <DeltaBadge field="Ops/sec" deltas={props.deltas} /></td>
          </tr>
        </tbody>
      </table>

      {/* Function: Memory table */}
      <Show when={isFn()}>
        <div style={{ "font-size": "11px", "font-weight": "600", color: "var(--text-secondary)", "margin-bottom": "6px" }}>
          Memory
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Metric</th>
              <th style={thStyle}>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Heap avg</td>
              <td style={tdStyle}>{fmtBytes(fnResult().memory.heapUsedAvg)} <DeltaBadge field="Heap avg" deltas={props.deltas} /></td>
            </tr>
            <tr>
              <td style={tdStyle}>Heap peak</td>
              <td style={tdStyle}>{fmtBytes(fnResult().memory.heapUsedPeak)}</td>
            </tr>
            <tr>
              <td style={tdStyle}>Heap total</td>
              <td style={tdStyle}>{fmtBytes(fnResult().memory.heapTotal)}</td>
            </tr>
            <tr>
              <td style={tdStyle}>RSS</td>
              <td style={tdStyle}>{fmtBytes(fnResult().memory.rss)} <DeltaBadge field="RSS" deltas={props.deltas} /></td>
            </tr>
          </tbody>
        </table>
      </Show>

      {/* HTTP: Throughput, errors, status codes */}
      <Show when={!isFn()}>
        <div style={{ "font-size": "11px", "font-weight": "600", color: "var(--text-secondary)", "margin-bottom": "6px" }}>
          Throughput & Errors
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Metric</th>
              <th style={thStyle}>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Throughput</td>
              <td style={tdStyle}>{fmt(httpResult().throughput, 1)} req/s <DeltaBadge field="Throughput" deltas={props.deltas} /></td>
            </tr>
            <tr>
              <td style={tdStyle}>Errors</td>
              <td style={tdStyle}>
                <span style={{ color: httpResult().errorCount > 0 ? "var(--danger)" : "var(--success)" }}>
                  {httpResult().errorCount}
                </span>
                <DeltaBadge field="Errors" deltas={props.deltas} />
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>Timeouts</td>
              <td style={tdStyle}>
                <span style={{ color: httpResult().timeoutCount > 0 ? "var(--danger)" : "var(--text-primary)" }}>
                  {httpResult().timeoutCount}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <Show when={Object.keys(httpResult().statusCodes).length > 0}>
          <div style={{ "font-size": "11px", "font-weight": "600", color: "var(--text-secondary)", "margin-bottom": "6px" }}>
            Status Codes
          </div>
          <div style={{ display: "flex", gap: "8px", "flex-wrap": "wrap" }}>
            <For each={Object.entries(httpResult().statusCodes)}>
              {([code, count]) => (
                <span style={{
                  padding: "3px 10px",
                  "border-radius": "var(--radius-sm)",
                  background: Number(code) < 400 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  color: Number(code) < 400 ? "var(--success)" : "var(--danger)",
                  "font-size": "12px",
                  "font-weight": "500",
                }}>
                  {code}: {count}
                </span>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
