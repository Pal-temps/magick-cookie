import { createSignal, onMount, For, Show } from "solid-js";
import { useWellnessStore } from "../../../application/stores/wellnessStore";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";

const DEFAULT_TYPES = ["water", "break", "stretch", "breathe"];

export function HabitSettings() {
  const { configs, fetchConfigs, createConfig, updateConfig, deleteConfig } = useWellnessStore();
  const { t } = useT();
  const [editing, setEditing] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);

  // Form fields
  const [formType, setFormType] = createSignal("");
  const [formLabel, setFormLabel] = createSignal("");
  const [formInterval, setFormInterval] = createSignal(60);
  const [formEnabled, setFormEnabled] = createSignal(true);

  onMount(() => {
    fetchConfigs();
  });

  const inputStyle = {
    width: "100%",
    padding: "6px 10px",
    "border-radius": "var(--radius-sm)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    "font-size": "13px",
    outline: "none",
    "box-sizing": "border-box" as const,
  };

  function resetForm() {
    setFormType("");
    setFormLabel("");
    setFormInterval(60);
    setFormEnabled(true);
    setEditing(null);
    setCreating(false);
  }

  function startCreate() {
    resetForm();
    setCreating(true);
  }

  function startEdit(config: { id: string; type: string; label: string; intervalMinutes: number; enabled: boolean }) {
    setEditing(config.id);
    setCreating(false);
    setFormType(config.type);
    setFormLabel(config.label);
    setFormInterval(config.intervalMinutes);
    setFormEnabled(config.enabled);
  }

  async function handleCreate() {
    const t = formType().trim();
    const l = formLabel().trim();
    if (!t || !l) return;
    try {
      await createConfig({ type: t, label: l, intervalMinutes: formInterval(), enabled: formEnabled() });
      resetForm();
    } catch (e) {
      console.error("Failed to create habit:", e);
    }
  }

  async function handleUpdate() {
    const id = editing();
    if (!id) return;
    try {
      await updateConfig(id, {
        label: formLabel().trim(),
        intervalMinutes: formInterval(),
        enabled: formEnabled(),
      });
      resetForm();
    } catch (e) {
      console.error("Failed to update habit:", e);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteConfig(id);
      if (editing() === id) resetForm();
    } catch (e) {
      console.error("Failed to delete habit:", e);
    }
  }

  async function handleToggle(config: { id: string; enabled: boolean }) {
    try {
      await updateConfig(config.id, { enabled: !config.enabled });
    } catch (e) {
      console.error("Failed to toggle habit:", e);
    }
  }

  function isDefault(type: string) {
    return DEFAULT_TYPES.includes(type);
  }

  return (
    <div style={{ padding: "24px", "max-width": "640px" }}>
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "20px" }}>
        <div>
          <h3 style={{ margin: "0 0 4px", "font-size": "16px", "font-weight": "600", color: "var(--text-primary)" }}>
            {t("settings.habitsTitle")}
          </h3>
          <p style={{ margin: "0", "font-size": "12px", color: "var(--text-muted)" }}>
            {t("settings.habitsDesc")}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={startCreate}>
          {t("common.add")}
        </Button>
      </div>

      {/* List */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "8px", "margin-bottom": "20px" }}>
        <For each={configs()}>
          {(config) => (
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "12px",
                padding: "10px 12px",
                background: editing() === config.id ? "var(--bg-elevated)" : "var(--bg-secondary)",
                "border-radius": "var(--radius-md)",
                border: editing() === config.id ? "1px solid var(--accent-color)" : "1px solid transparent",
              }}
            >
              {/* Toggle */}
              <label style={{ "flex-shrink": "0", cursor: "pointer", display: "flex", "align-items": "center" }}>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={() => handleToggle(config)}
                  style={{ cursor: "pointer" }}
                />
              </label>

              {/* Info */}
              <div style={{ flex: "1", "min-width": "0" }}>
                <div style={{
                  "font-size": "13px",
                  "font-weight": "500",
                  color: config.enabled ? "var(--text-primary)" : "var(--text-muted)",
                }}>
                  {config.label}
                </div>
                <div style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                  {config.type} — {t("settings.every")} {config.intervalMinutes} min
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "4px", "flex-shrink": "0" }}>
                <Button variant="ghost" size="sm" onClick={() => startEdit(config)}>
                  {t("common.edit")}
                </Button>
                <Show when={!isDefault(config.type)}>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(config.id)}>
                    {t("common.delete")}
                  </Button>
                </Show>
              </div>
            </div>
          )}
        </For>
        <Show when={configs().length === 0}>
          <p style={{ "font-size": "13px", color: "var(--text-muted)", "text-align": "center", padding: "20px 0" }}>
            {t("settings.noHabits")}
          </p>
        </Show>
      </div>

      {/* Create / Edit form */}
      <Show when={creating() || editing()}>
        <div style={{
          padding: "16px",
          background: "var(--bg-elevated)",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--border-color)",
        }}>
          <h4 style={{ margin: "0 0 12px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
            {creating() ? t("settings.newHabit") : t("settings.editHabit")}
          </h4>

          <div style={{ display: "flex", "flex-direction": "column", gap: "10px" }}>
            {/* Type (only for create) */}
            <Show when={creating()}>
              <div>
                <label style={{ display: "block", "font-size": "12px", color: "var(--text-muted)", "margin-bottom": "4px" }}>
                  {t("settings.slugId")}
                </label>
                <input
                  type="text"
                  value={formType()}
                  onInput={(e) => setFormType(e.currentTarget.value)}
                  placeholder="ex: meditation"
                  style={inputStyle}
                />
              </div>
            </Show>

            {/* Label */}
            <div>
              <label style={{ display: "block", "font-size": "12px", color: "var(--text-muted)", "margin-bottom": "4px" }}>
                {t("settings.label")}
              </label>
              <input
                type="text"
                value={formLabel()}
                onInput={(e) => setFormLabel(e.currentTarget.value)}
                placeholder="ex: Mediter 5 minutes"
                style={inputStyle}
              />
            </div>

            {/* Interval */}
            <div>
              <label style={{ display: "block", "font-size": "12px", color: "var(--text-muted)", "margin-bottom": "4px" }}>
                {t("settings.intervalMinutes")}
              </label>
              <input
                type="number"
                value={formInterval()}
                onInput={(e) => setFormInterval(parseInt(e.currentTarget.value) || 0)}
                min={1}
                style={inputStyle}
              />
            </div>

            {/* Enabled */}
            <label style={{ display: "flex", "align-items": "center", gap: "8px", "font-size": "13px", color: "var(--text-primary)" }}>
              <input
                type="checkbox"
                checked={formEnabled()}
                onChange={(e) => setFormEnabled(e.currentTarget.checked)}
              />
              {t("settings.active")}
            </label>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "8px", "margin-top": "4px" }}>
              <Show when={creating()}>
                <Button variant="primary" size="sm" onClick={handleCreate}>
                  {t("common.create")}
                </Button>
              </Show>
              <Show when={editing()}>
                <Button variant="primary" size="sm" onClick={handleUpdate}>
                  {t("common.save")}
                </Button>
              </Show>
              <Button variant="secondary" size="sm" onClick={resetForm}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
