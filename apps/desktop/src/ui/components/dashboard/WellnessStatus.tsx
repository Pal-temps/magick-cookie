import { For, Show, createSignal } from "solid-js";
import { useWellnessStore } from "../../../application/stores/wellnessStore";
import { Button } from "../common/Button";
import { SOUND_OPTIONS, playSound, type SoundName } from "../../../infrastructure/audio/soundPlayer";
import { useT } from "../../../i18n/context";

const ICONS: Record<string, string> = {
  water: "\u{1F4A7}",
  break: "\u{2615}",
  stretch: "\u{1F9D8}",
  breathe: "\u{1F32C}\u{FE0F}",
};

const inputStyle = {
  padding: "5px 8px",
  "border-radius": "var(--radius-md)",
  border: "1px solid var(--border-color)",
  background: "var(--bg-base)",
  color: "var(--text-primary)",
  "font-size": "12px",
};

const labelStyle = {
  "font-size": "11px",
  color: "var(--text-muted)",
  "margin-bottom": "4px",
};

export function WellnessStatus() {
  const { configs, updateConfig, deleteConfig, createConfig, snooze } = useWellnessStore();
  const { t } = useT();
  const [showForm, setShowForm] = createSignal(false);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);
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

  function toggleExpand(id: string) {
    setExpandedId(expandedId() === id ? null : id);
  }

  return (
    <div>
      <div style={{ display: "flex", "justify-content": "flex-end", "margin-bottom": "8px" }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowForm(!showForm())}
          style={{ "font-size": "12px", padding: "2px 8px" }}
        >
          {showForm() ? t("common.cancel") : `+ ${t("common.add")}`}
        </Button>
      </div>

      {/* ─── Create form ─── */}
      <Show when={showForm()}>
        <div style={{
          display: "flex", "flex-direction": "column", gap: "10px",
          padding: "12px", "border-radius": "var(--radius-md)",
          background: "var(--bg-elevated)", "margin-bottom": "12px",
          border: "1px solid var(--border-color)",
        }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <div style={{ flex: "1" }}>
              <div style={labelStyle}>{t("dashboard.type")}</div>
              <input type="text" placeholder="ex: posture" value={newType()} onInput={(e) => setNewType(e.target.value)} style={{ ...inputStyle, width: "100%", "box-sizing": "border-box" }} />
            </div>
            <div style={{ flex: "2" }}>
              <div style={labelStyle}>{t("dashboard.label")}</div>
              <input type="text" placeholder="ex: Corriger sa posture" value={newLabel()} onInput={(e) => setNewLabel(e.target.value)} style={{ ...inputStyle, width: "100%", "box-sizing": "border-box" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "6px", "align-items": "flex-end" }}>
            <div>
              <div style={labelStyle}>{t("dashboard.interval")}</div>
              <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <input type="number" min="1" max="480" value={newInterval()} onInput={(e) => setNewInterval(Number(e.target.value))} style={{ ...inputStyle, width: "60px", "text-align": "center" }} />
                <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>min</span>
              </div>
            </div>
            <div style={{ flex: "1" }}>
              <div style={labelStyle}>{t("dashboard.sound")}</div>
              <div style={{ display: "flex", gap: "4px" }}>
                <select value={newSound()} onChange={(e) => setNewSound(e.currentTarget.value)} style={{ ...inputStyle, flex: "1", cursor: "pointer" }}>
                  <For each={SOUND_OPTIONS}>{(s) => <option value={s.value}>{s.label}</option>}</For>
                </select>
                <button type="button" onClick={() => playSound(newSound() as SoundName)} title={t("dashboard.listen")} style={{ ...inputStyle, cursor: "pointer", "font-size": "12px", "line-height": "1" }}>&#9654;</button>
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={handleCreate}>{t("common.create")}</Button>
          </div>
        </div>
      </Show>

      <Show when={configs().length === 0}>
        <div style={{ "font-size": "12px", color: "var(--text-muted)" }}>{t("dashboard.noReminder")}</div>
      </Show>

      {/* ─── Config list ─── */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
        <For each={configs()}>
          {(config) => {
            const isExpanded = () => expandedId() === config.id;
            return (
              <div style={{
                "border-radius": "var(--radius-md)",
                background: config.enabled ? "var(--bg-elevated)" : "transparent",
                border: isExpanded() ? "1px solid var(--border-color)" : "1px solid transparent",
                opacity: config.enabled ? "1" : "0.5",
                transition: "var(--transition-fast)",
              }}>
                {/* ── Row: compact ── */}
                <div style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "8px 10px",
                }}>
                  <span style={{ "font-size": "15px", "flex-shrink": "0" }}>
                    {ICONS[config.type] || "\u{1F514}"}
                  </span>
                  <div style={{ flex: "1", "min-width": "0" }}>
                    <div style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                      {config.label}
                    </div>
                    <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "1px" }}>
                      {config.intervalMinutes} min
                    </div>
                  </div>

                  {/* Snooze (only when enabled and not expanded) */}
                  <Show when={config.enabled && !isExpanded()}>
                    <button
                      onClick={() => snooze(config.id, 10)}
                      title={t("dashboard.snooze")}
                      style={{
                        padding: "2px 6px",
                        "border-radius": "var(--radius-sm)",
                        border: "1px solid var(--border-color)",
                        background: "transparent",
                        color: "var(--text-muted)",
                        "font-size": "10px",
                        cursor: "pointer",
                        "flex-shrink": "0",
                        "white-space": "nowrap",
                      }}
                    >+10min</button>
                  </Show>

                  {/* Settings gear */}
                  <button
                    onClick={() => toggleExpand(config.id)}
                    title={t("nav.settings")}
                    style={{
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "center",
                      width: "26px",
                      height: "26px",
                      "border-radius": "var(--radius-sm)",
                      border: "none",
                      background: isExpanded() ? "color-mix(in srgb, var(--accent-primary) 15%, transparent)" : "transparent",
                      color: isExpanded() ? "var(--accent-primary)" : "var(--text-muted)",
                      cursor: "pointer",
                      "flex-shrink": "0",
                      transition: "var(--transition-fast)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.116l.094-.318z"/>
                      <path d="M8 5.754a2.246 2.246 0 1 0 0 4.492 2.246 2.246 0 0 0 0-4.492zM6.754 8a1.246 1.246 0 1 1 2.492 0 1.246 1.246 0 0 1-2.492 0z"/>
                    </svg>
                  </button>

                  {/* Toggle */}
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
                </div>

                {/* ── Settings panel ── */}
                <Show when={isExpanded()}>
                  <div style={{
                    padding: "0 10px 10px",
                    display: "flex",
                    "flex-direction": "column",
                    gap: "10px",
                    "border-top": "1px solid var(--border-color)",
                    "margin-top": "0",
                    "padding-top": "10px",
                  }}>
                    {/* Interval + Snooze row */}
                    <div style={{ display: "flex", gap: "8px", "align-items": "flex-end", "flex-wrap": "wrap" }}>
                      <div>
                        <div style={labelStyle}>{t("dashboard.interval")}</div>
                        <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                          <input
                            type="number"
                            min="1"
                            max="480"
                            value={config.intervalMinutes}
                            onChange={(e) => updateConfig(config.id, { intervalMinutes: Number(e.currentTarget.value) })}
                            style={{ ...inputStyle, width: "60px", "text-align": "center" }}
                          />
                          <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>min</span>
                        </div>
                      </div>
                      <Show when={config.enabled}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => snooze(config.id, 10)}
                          style={{ "font-size": "11px" }}
                        >
                          {t("dashboard.snooze")}
                        </Button>
                      </Show>
                    </div>

                    {/* Sound row */}
                    <div>
                      <div style={labelStyle}>{t("dashboard.notificationSound")}</div>
                      <div style={{ display: "flex", gap: "6px", "align-items": "center" }}>
                        <select
                          value={config.alertSound ?? "notification"}
                          onChange={(e) => updateConfig(config.id, { alertSound: e.currentTarget.value })}
                          style={{ ...inputStyle, flex: "1", cursor: "pointer" }}
                        >
                          <For each={SOUND_OPTIONS}>
                            {(s) => <option value={s.value}>{s.label}</option>}
                          </For>
                        </select>
                        <button
                          type="button"
                          onClick={() => playSound((config.alertSound ?? "notification") as SoundName)}
                          title={t("dashboard.listen")}
                          style={{ ...inputStyle, cursor: "pointer", "font-size": "12px", "line-height": "1" }}
                        >&#9654;</button>
                      </div>
                    </div>

                    {/* Delete */}
                    <div style={{ display: "flex", "justify-content": "flex-end", "padding-top": "4px", "border-top": "1px solid var(--border-color)" }}>
                      <button
                        onClick={() => { deleteConfig(config.id); setExpandedId(null); }}
                        style={{
                          display: "flex",
                          "align-items": "center",
                          gap: "4px",
                          padding: "4px 10px",
                          "border-radius": "var(--radius-md)",
                          border: "1px solid var(--cal-red, #e74c3c)",
                          background: "transparent",
                          color: "var(--cal-red, #e74c3c)",
                          "font-size": "11px",
                          cursor: "pointer",
                          transition: "var(--transition-fast)",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                          <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H5.5l1-1h3l1 1h2.5a1 1 0 0 1 1 1v1z"/>
                        </svg>
                        {t("common.delete")}
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
