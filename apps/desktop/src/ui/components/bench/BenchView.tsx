import { Show } from "solid-js";
import { useBenchStore } from "../../../application/stores/benchStore";
import { FunctionBenchPanel } from "./FunctionBenchPanel";
import { HttpBenchPanel } from "./HttpBenchPanel";
import { BenchHistoryPanel } from "./BenchHistoryPanel";

export function BenchView() {
  const bench = useBenchStore();

  const tabs = [
    { id: "function" as const, label: "Function" },
    { id: "http" as const, label: "HTTP Load Test" },
    { id: "history" as const, label: "Historique" },
  ];

  return (
    <div style={{
      height: "100%",
      overflow: "auto",
      padding: "20px 24px",
      display: "flex",
      "flex-direction": "column",
      gap: "20px",
    }}>
      {/* Header */}
      <h2 style={{
        margin: "0",
        "font-size": "18px",
        "font-weight": "600",
        color: "var(--text-primary)",
      }}>
        Bench
      </h2>

      {/* Tab buttons */}
      <div style={{
        display: "flex",
        gap: "4px",
        background: "var(--bg-base)",
        padding: "3px",
        "border-radius": "var(--radius-md)",
        "align-self": "flex-start",
      }}>
        {tabs.map((tab) => (
          <button
            onClick={() => bench.setBenchTab(tab.id)}
            style={{
              padding: "6px 14px",
              "border-radius": "var(--radius-sm)",
              border: "none",
              background: bench.benchTab() === tab.id ? "var(--bg-surface)" : "transparent",
              color: bench.benchTab() === tab.id ? "var(--text-primary)" : "var(--text-muted)",
              "font-size": "12px",
              "font-weight": bench.benchTab() === tab.id ? "600" : "normal",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
              ...(bench.benchTab() === tab.id ? { "box-shadow": "0 1px 2px rgba(0,0,0,0.08)" } : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      <Show when={bench.benchTab() === "function"}>
        <FunctionBenchPanel />
      </Show>
      <Show when={bench.benchTab() === "http"}>
        <HttpBenchPanel />
      </Show>
      <Show when={bench.benchTab() === "history"}>
        <BenchHistoryPanel />
      </Show>
    </div>
  );
}
