import { Show } from "solid-js";
import { useBenchStore } from "../../../application/stores/benchStore";
import { BenchResultCard } from "./BenchResultCard";

export function HttpBenchPanel() {
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

  const isLocal = () => bench.httpUrl().startsWith("http://localhost:47300");
  const showBody = () => bench.httpMethod() === "POST" || bench.httpMethod() === "PUT";

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
      {/* URL + Method row */}
      <div style={{ display: "flex", gap: "10px", "align-items": "flex-end" }}>
        <div style={{ flex: "1", display: "flex", "flex-direction": "column" }}>
          <div style={labelStyle}>URL</div>
          <div style={{ position: "relative", display: "flex", "align-items": "center" }}>
            <input
              type="url"
              value={bench.httpUrl()}
              onInput={(e) => bench.setHttpUrl(e.currentTarget.value)}
              placeholder="http://localhost:47300/api/health"
              style={{ ...inputStyle, width: "100%", "padding-left": isLocal() ? "26px" : "10px" }}
            />
            <Show when={isLocal()}>
              <span style={{
                position: "absolute",
                left: "10px",
                width: "8px",
                height: "8px",
                "border-radius": "50%",
                background: "var(--success)",
              }} />
            </Show>
          </div>
        </div>
        <div style={{ display: "flex", "flex-direction": "column", "min-width": "110px" }}>
          <div style={labelStyle}>Methode</div>
          <select
            value={bench.httpMethod()}
            onChange={(e) => bench.setHttpMethod(e.currentTarget.value)}
            style={{
              ...inputStyle,
              width: "100%",
              cursor: "pointer",
              appearance: "auto" as const,
            }}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>

      {/* Body textarea (POST/PUT only) */}
      <Show when={showBody()}>
        <div style={{ display: "flex", "flex-direction": "column" }}>
          <div style={labelStyle}>Body (JSON)</div>
          <textarea
            value={bench.httpBody()}
            onInput={(e) => bench.setHttpBody(e.currentTarget.value)}
            placeholder='{"key": "value"}'
            spellcheck={false}
            style={{
              ...inputStyle,
              width: "100%",
              "min-height": "80px",
              "font-family": "monospace",
              "font-size": "13px",
              resize: "vertical",
              "line-height": "1.5",
            }}
          />
        </div>
      </Show>

      {/* Config row */}
      <div style={{ display: "flex", gap: "12px", "flex-wrap": "wrap" }}>
        <div style={{ display: "flex", "flex-direction": "column", flex: "1", "min-width": "100px" }}>
          <div style={labelStyle}>Concurrence</div>
          <input
            type="number"
            value={bench.httpConcurrency()}
            onInput={(e) => bench.setHttpConcurrency(parseInt(e.currentTarget.value) || 0)}
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", "flex-direction": "column", flex: "1", "min-width": "100px" }}>
          <div style={labelStyle}>Total requetes</div>
          <input
            type="number"
            value={bench.httpTotalRequests()}
            onInput={(e) => bench.setHttpTotalRequests(parseInt(e.currentTarget.value) || 0)}
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", "flex-direction": "column", flex: "1", "min-width": "100px" }}>
          <div style={labelStyle}>Timeout (ms)</div>
          <input
            type="number"
            value={bench.httpTimeout()}
            onInput={(e) => bench.setHttpTimeout(parseInt(e.currentTarget.value) || 0)}
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={() => bench.runHttpBench()}
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
        {(result) => <BenchResultCard result={result()} />}
      </Show>
    </div>
  );
}
