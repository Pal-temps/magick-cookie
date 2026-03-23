import { Show } from "solid-js";
import { useBenchStore } from "../../../application/stores/benchStore";
import { BenchResultCard } from "./BenchResultCard";

export function FunctionBenchPanel() {
  const bench = useBenchStore();

  const inputStyle = {
    padding: "6px 10px",
    "border-radius": "var(--radius-sm)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-base)",
    color: "var(--text-primary)",
    "font-size": "13px",
    outline: "none",
    "box-sizing": "border-box" as const,
  };

  const labelStyle = {
    "font-size": "11px",
    "font-weight": "600",
    color: "var(--text-secondary)",
    "margin-bottom": "4px",
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
      {/* Code textarea */}
      <div style={{ display: "flex", "flex-direction": "column" }}>
        <div style={labelStyle}>Code a benchmarker</div>
        <textarea
          value={bench.fnCode()}
          onInput={(e) => bench.setFnCode(e.currentTarget.value)}
          spellcheck={false}
          style={{
            ...inputStyle,
            width: "100%",
            "min-height": "120px",
            "font-family": "monospace",
            "font-size": "13px",
            resize: "vertical",
            "line-height": "1.5",
          }}
        />
      </div>

      {/* Bench name */}
      <div style={{ display: "flex", "flex-direction": "column" }}>
        <div style={labelStyle}>Nom du benchmark</div>
        <input
          type="text"
          value={bench.fnName()}
          onInput={(e) => bench.setFnName(e.currentTarget.value)}
          placeholder="example-bench"
          style={{ ...inputStyle, width: "100%" }}
        />
      </div>

      {/* Config row */}
      <div style={{ display: "flex", gap: "12px", "flex-wrap": "wrap" }}>
        <div style={{ display: "flex", "flex-direction": "column", flex: "1", "min-width": "100px" }}>
          <div style={labelStyle}>Iterations</div>
          <input
            type="number"
            value={bench.fnIterations()}
            onInput={(e) => bench.setFnIterations(parseInt(e.currentTarget.value) || 0)}
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", "flex-direction": "column", flex: "1", "min-width": "100px" }}>
          <div style={labelStyle}>Warmup</div>
          <input
            type="number"
            value={bench.fnWarmup()}
            onInput={(e) => bench.setFnWarmup(parseInt(e.currentTarget.value) || 0)}
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", "flex-direction": "column", flex: "1", "min-width": "100px" }}>
          <div style={labelStyle}>Timeout (ms)</div>
          <input
            type="number"
            value={bench.fnTimeout()}
            onInput={(e) => bench.setFnTimeout(parseInt(e.currentTarget.value) || 0)}
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={() => bench.runFunctionBench()}
        disabled={bench.isRunning()}
        style={{
          padding: "8px 20px",
          "border-radius": "var(--radius-sm)",
          border: "none",
          background: bench.isRunning() ? "var(--text-muted)" : "var(--accent-primary)",
          color: "#fff",
          "font-size": "13px",
          "font-weight": "600",
          cursor: bench.isRunning() ? "default" : "pointer",
          opacity: bench.isRunning() ? "0.6" : "1",
          "align-self": "flex-start",
          transition: "opacity 0.15s, background 0.15s",
        }}
      >
        {bench.isRunning() ? "En cours..." : "Lancer"}
      </button>

      {/* Progress bar */}
      <Show when={bench.progress()}>
        {(p) => (
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <div style={{ display: "flex", "justify-content": "space-between", "font-size": "11px", color: "var(--text-secondary)" }}>
              <span style={{ "text-transform": "capitalize" }}>{p().phase}</span>
              <span>{p().current} / {p().total}</span>
            </div>
            <div style={{
              height: "6px",
              "border-radius": "3px",
              background: "var(--bg-base)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${p().total > 0 ? Math.round((p().current / p().total) * 100) : 0}%`,
                background: "var(--accent-primary)",
                "border-radius": "3px",
                transition: "width 0.2s ease",
              }} />
            </div>
          </div>
        )}
      </Show>

      {/* Error */}
      <Show when={bench.error()}>
        {(err) => (
          <div style={{
            padding: "10px 14px",
            "border-radius": "var(--radius-sm)",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            "font-size": "12px",
            "line-height": "1.4",
          }}>
            {err()}
          </div>
        )}
      </Show>

      {/* Results */}
      <Show when={bench.currentResult()}>
        {(result) => {
          const deltas = () => {
            const prev = bench.previousResult();
            return prev ? bench.computeDeltas(result(), prev) : undefined;
          };
          return <BenchResultCard result={result()} deltas={deltas()} />;
        }}
      </Show>
    </div>
  );
}
