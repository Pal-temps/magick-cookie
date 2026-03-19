import { For, Show, createSignal } from "solid-js";
import { useWellnessStore } from "../../../application/stores/wellnessStore";
import { Button } from "../common/Button";
import { SOUND_OPTIONS, playSound, type SoundName } from "../../../infrastructure/audio/soundPlayer";

const ICONS: Record<string, string> = {
  water: "\u{1F4A7}",
  break: "\u{2615}",
  stretch: "\u{1F9D8}",
  breathe: "\u{1F32C}\u{FE0F}",
};

export function WellnessStatus() {
  const { configs, updateConfig, deleteConfig, createConfig, snooze } = useWellnessStore();
  const [showForm, setShowForm] = createSignal(false);
  const [newType, setNewType] = createSignal("");
  const [newLabel, setNewLabel] = createSignal("");
  const [newInterval, setNewInterval] = createSignal(60);
  const [newSound, setNewSound] = createSignal<string>("notification");

  async function handleCreate() {
    const type = newType().trim();
    const label = newLabel().trim();
    if (!type || !label || newInterval() < 1) return;

    await createConfig({ type, label, intervalMinutes: newInterval(), enabled: true, alertSound: newSound() });
    setNewType("");
    setNewLabel("");
    setNewInterval(60);
    setNewSound("notification");
    setShowForm(false);
  }

  const inputStyle = {
    padding: "4px 8px",
    "border-radius": "var(--radius-md)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    "font-size": "12px",
  };

  return (
    <div>
      <div style={{ display: "flex", "justify-content": "flex-end", "margin-bottom": "8px" }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowForm(!showForm())}
          style={{ "font-size": "12px", padding: "2px 8px" }}
        >
          {showForm() ? "Annuler" : "+ Ajouter"}
        </Button>
      </div>

      {/* Add form */}
      <Show when={showForm()}>
        <div style={{
          display: "flex", "flex-direction": "column", gap: "8px",
          padding: "10px", "border-radius": "var(--radius-md)",
          background: "var(--bg-elevated)", "margin-bottom": "12px",
        }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type="text"
              placeholder="Type (ex: posture)"
              value={newType()}
              onInput={(e) => setNewType(e.target.value)}
              style={{ ...inputStyle, flex: "1" }}
            />
            <input
              type="text"
              placeholder="Label (ex: Corriger sa posture)"
              value={newLabel()}
              onInput={(e) => setNewLabel(e.target.value)}
              style={{ ...inputStyle, flex: "2" }}
            />
          </div>
          <div style={{ display: "flex", gap: "6px", "align-items": "center" }}>
            <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>Toutes les</span>
            <input
              type="number"
              min="1"
              max="480"
              value={newInterval()}
              onInput={(e) => setNewInterval(Number(e.target.value))}
              style={{ ...inputStyle, width: "60px", "text-align": "center" }}
            />
            <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>min</span>
          </div>
          <div style={{ display: "flex", gap: "6px", "align-items": "center" }}>
            <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>Son</span>
            <select
              value={newSound()}
              onChange={(e) => setNewSound(e.currentTarget.value)}
              style={{ ...inputStyle, flex: "1", cursor: "pointer" }}
            >
              <For each={SOUND_OPTIONS}>
                {(s) => <option value={s.value}>{s.label}</option>}
              </For>
            </select>
            <button
              type="button"
              onClick={() => playSound(newSound() as SoundName)}
              title="Ecouter"
              style={{
                background: "none", border: "1px solid var(--border-color)", cursor: "pointer",
                "border-radius": "var(--radius-md)", padding: "3px 8px", "font-size": "14px",
                color: "var(--text-secondary)",
              }}
            >&#9654;</button>
            <Button variant="primary" size="sm" onClick={handleCreate} style={{ "margin-left": "auto" }}>
              Creer
            </Button>
          </div>
        </div>
      </Show>

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
                <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-top": "2px" }}>
                  <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                    Toutes les {config.intervalMinutes} min
                  </span>
                  <select
                    value={config.alertSound ?? "notification"}
                    onChange={(e) => updateConfig(config.id, { alertSound: e.currentTarget.value })}
                    style={{
                      padding: "1px 4px",
                      "border-radius": "var(--radius-sm)",
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-base)",
                      color: "var(--text-muted)",
                      "font-size": "10px",
                      cursor: "pointer",
                    }}
                  >
                    <For each={SOUND_OPTIONS}>
                      {(s) => <option value={s.value}>{s.label}</option>}
                    </For>
                  </select>
                  <button
                    type="button"
                    onClick={() => playSound((config.alertSound ?? "notification") as SoundName)}
                    title="Ecouter"
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      "font-size": "11px", color: "var(--text-muted)", padding: "0",
                    }}
                  >&#9654;</button>
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
                  "flex-shrink": "0",
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
              <button
                onClick={() => deleteConfig(config.id)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", "font-size": "14px", padding: "0 2px",
                  "line-height": "1",
                }}
                title="Supprimer"
              >
                &times;
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
