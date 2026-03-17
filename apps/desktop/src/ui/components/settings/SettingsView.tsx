import { createSignal, Show } from "solid-js";
import { LlmSettings } from "./LlmSettings";

type SettingsTab = "llm";

export function SettingsView() {
  const [tab, setTab] = createSignal<SettingsTab>("llm");

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "llm", label: "Intelligence artificielle" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{
        width: "200px",
        "flex-shrink": "0",
        "border-right": "1px solid var(--border-color)",
        padding: "16px 0",
        "overflow-y": "auto",
      }}>
        <div style={{
          padding: "0 16px 12px",
          "font-size": "11px",
          "font-weight": "600",
          "text-transform": "uppercase",
          "letter-spacing": "0.05em",
          color: "var(--text-muted)",
        }}>
          Parametres
        </div>
        {tabs.map((t) => (
          <button
            onClick={() => setTab(t.id)}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 16px",
              border: "none",
              background: tab() === t.id ? "var(--bg-elevated)" : "transparent",
              color: tab() === t.id ? "var(--text-primary)" : "var(--text-muted)",
              "font-size": "13px",
              "text-align": "left",
              cursor: "pointer",
              "font-weight": tab() === t.id ? "500" : "400",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: "1", "overflow-y": "auto" }}>
        <Show when={tab() === "llm"}>
          <LlmSettings />
        </Show>
      </div>
    </div>
  );
}
