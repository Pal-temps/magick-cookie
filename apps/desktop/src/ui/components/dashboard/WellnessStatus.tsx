import { For, Show } from "solid-js";
import { useWellnessStore } from "../../../application/stores/wellnessStore";
import { Button } from "../common/Button";

const ICONS: Record<string, string> = {
  water: "\u{1F4A7}",
  break: "\u{2615}",
  stretch: "\u{1F9D8}",
  breathe: "\u{1F32C}\u{FE0F}",
};

export function WellnessStatus() {
  const { configs, updateConfig, snooze } = useWellnessStore();

  return (
    <div style={{
      background: "var(--bg-surface)",
      "border-radius": "var(--radius-lg)",
      border: "1px solid var(--border-color)",
      padding: "20px",
    }}>
      <h3 style={{ margin: "0 0 16px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
        Bien-etre
      </h3>

      <Show when={configs().length === 0}>
        <div style={{ "font-size": "12px", color: "var(--text-muted)" }}>Aucun rappel configure</div>
      </Show>

      <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
        <For each={configs()}>
          {(config) => (
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "10px",
              padding: "8px 10px",
              "border-radius": "var(--radius-md)",
              background: config.enabled ? "var(--bg-elevated)" : "transparent",
              opacity: config.enabled ? "1" : "0.5",
            }}>
              <span style={{ "font-size": "16px" }}>{ICONS[config.type] || "\u{1F514}"}</span>
              <div style={{ flex: "1", "min-width": "0" }}>
                <div style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)" }}>
                  {config.label}
                </div>
                <div style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                  Toutes les {config.intervalMinutes} min
                </div>
              </div>
              <Show when={config.enabled}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => snooze(config.id, 10)}
                  style={{ "font-size": "10px", padding: "2px 6px" }}
                >
                  +10min
                </Button>
              </Show>
              <button
                onClick={() => updateConfig(config.id, { enabled: !config.enabled })}
                style={{
                  width: "36px",
                  height: "20px",
                  "border-radius": "10px",
                  border: "none",
                  cursor: "pointer",
                  background: config.enabled ? "var(--accent-primary)" : "var(--border-color)",
                  position: "relative",
                  transition: "var(--transition-fast)",
                }}
              >
                <span style={{
                  position: "absolute",
                  top: "2px",
                  left: config.enabled ? "18px" : "2px",
                  width: "16px",
                  height: "16px",
                  "border-radius": "50%",
                  background: "white",
                  transition: "var(--transition-fast)",
                }} />
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
