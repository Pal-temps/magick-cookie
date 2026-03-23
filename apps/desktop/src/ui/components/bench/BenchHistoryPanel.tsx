import { Show, For, onMount, createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useBenchStore } from "../../../application/stores/benchStore";
import { BenchResultCard } from "./BenchResultCard";
import type { BenchResult } from "../../../application/stores/benchStore";

export function BenchHistoryPanel() {
  const bench = useBenchStore();
  const [expandedPath, setExpandedPath] = createSignal<string | null>(null);
  const [expandedResult, setExpandedResult] = createSignal<BenchResult | null>(null);
  const [loadingPath, setLoadingPath] = createSignal<string | null>(null);

  onMount(() => {
    bench.loadHistory();
  });

  async function toggleEntry(path: string) {
    if (expandedPath() === path) {
      setExpandedPath(null);
      setExpandedResult(null);
      return;
    }

    setExpandedPath(path);
    setExpandedResult(null);
    setLoadingPath(path);

    try {
      const content = await invoke<string>("notes_read", { path });
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        setExpandedResult(JSON.parse(jsonMatch[1]) as BenchResult);
      }
    } catch (e) {
      console.error("Failed to load bench result:", e);
    } finally {
      setLoadingPath(null);
    }
  }

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
      <Show when={bench.history().length === 0}>
        <div style={{
          padding: "40px 0",
          "text-align": "center",
          color: "var(--text-muted)",
          "font-size": "13px",
        }}>
          Aucun historique de benchmark. Lancez un bench pour commencer.
        </div>
      </Show>

      <For each={bench.history()}>
        {(entry) => (
          <div>
            {/* Entry card */}
            <div
              onClick={() => toggleEntry(entry.path)}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "10px",
                padding: "10px 14px",
                background: expandedPath() === entry.path ? "var(--bg-elevated)" : "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                "border-radius": expandedPath() === entry.path ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)",
                cursor: "pointer",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (expandedPath() !== entry.path) e.currentTarget.style.background = "var(--bg-elevated)";
              }}
              onMouseLeave={(e) => {
                if (expandedPath() !== entry.path) e.currentTarget.style.background = "var(--bg-surface)";
              }}
            >
              {/* Type badge */}
              <span style={{
                width: "24px",
                height: "24px",
                "border-radius": "var(--radius-sm)",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                "font-size": "11px",
                "font-weight": "700",
                "flex-shrink": "0",
                background: entry.type === "function" ? "rgba(99, 102, 241, 0.15)" : "rgba(16, 185, 129, 0.15)",
                color: entry.type === "function" ? "#6366f1" : "#10b981",
              }}>
                {entry.type === "function" ? "F" : "H"}
              </span>

              {/* Name + date */}
              <div style={{ flex: "1", "min-width": "0" }}>
                <div style={{
                  "font-size": "13px",
                  "font-weight": "500",
                  color: "var(--text-primary)",
                  "white-space": "nowrap",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                }}>
                  {entry.name}
                </div>
                <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "1px" }}>
                  {entry.date}
                </div>
              </div>

              {/* Key metric */}
              <span style={{
                "font-size": "12px",
                "font-weight": "600",
                color: "var(--accent-primary)",
                "flex-shrink": "0",
                "white-space": "nowrap",
              }}>
                {entry.keyMetric}
              </span>

              {/* Expand indicator */}
              <span style={{
                "font-size": "10px",
                color: "var(--text-muted)",
                "flex-shrink": "0",
                transform: expandedPath() === entry.path ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s",
              }}>
                {"\u25BC"}
              </span>
            </div>

            {/* Expanded result */}
            <Show when={expandedPath() === entry.path}>
              <div style={{
                padding: "12px",
                border: "1px solid var(--border-color)",
                "border-top": "none",
                "border-radius": "0 0 var(--radius-md) var(--radius-md)",
                background: "var(--bg-base)",
              }}>
                <Show when={loadingPath() === entry.path}>
                  <div style={{
                    padding: "20px 0",
                    "text-align": "center",
                    color: "var(--text-muted)",
                    "font-size": "12px",
                  }}>
                    Chargement...
                  </div>
                </Show>
                <Show when={expandedResult() && loadingPath() !== entry.path}>
                  {(result) => <BenchResultCard result={result()} />}
                </Show>
                <Show when={!expandedResult() && loadingPath() !== entry.path}>
                  <div style={{
                    padding: "12px 0",
                    "text-align": "center",
                    color: "var(--text-muted)",
                    "font-size": "12px",
                  }}>
                    Aucune donnee JSON trouvee dans ce fichier.
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}
