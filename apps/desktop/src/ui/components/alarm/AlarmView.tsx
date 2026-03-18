import { createSignal, For, Show } from "solid-js";
import { useAlarmStore, type Alarm, type CreateAlarmInput } from "../../../application/stores/alarmStore";
import { Button } from "../common/Button";

const REPEAT_LABELS: Record<string, string> = {
  once: "Une fois",
  daily: "Tous les jours",
  weekdays: "Lun-Ven",
  weekends: "Sam-Dim",
  custom: "Personnalise",
};

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const REPEAT_OPTIONS: { value: Alarm["repeatPattern"]; label: string }[] = [
  { value: "once", label: "Une fois" },
  { value: "daily", label: "Tous les jours" },
  { value: "weekdays", label: "Jours ouvres" },
  { value: "weekends", label: "Week-end" },
  { value: "custom", label: "Personnalise" },
];

function formatRepeatDisplay(alarm: Alarm): string {
  if (alarm.repeatPattern === "custom" && alarm.repeatDays) {
    return alarm.repeatDays.map((d) => DAY_LABELS[d]).join(", ");
  }
  return REPEAT_LABELS[alarm.repeatPattern] ?? alarm.repeatPattern;
}

export function AlarmView() {
  const { alarms, createAlarm, updateAlarm, deleteAlarm } = useAlarmStore();
  const [editing, setEditing] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [time, setTime] = createSignal("08:00");
  const [label, setLabel] = createSignal("");
  const [repeatPattern, setRepeatPattern] = createSignal<Alarm["repeatPattern"]>("once");
  const [repeatDays, setRepeatDays] = createSignal<number[]>([]);
  const [repeatDropdownOpen, setRepeatDropdownOpen] = createSignal(false);

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
    setTime("08:00");
    setLabel("");
    setRepeatPattern("once");
    setRepeatDays([]);
    setRepeatDropdownOpen(false);
    setEditing(null);
    setCreating(false);
  }

  function startCreate() {
    resetForm();
    setCreating(true);
  }

  function startEdit(alarm: Alarm) {
    setTime(alarm.time);
    setLabel(alarm.label);
    setRepeatPattern(alarm.repeatPattern);
    setRepeatDays(alarm.repeatDays ?? []);
    setEditing(alarm.id);
    setCreating(false);
  }

  async function handleSave() {
    const t = time().trim();
    const l = label().trim();
    if (!t || !l) return;

    const input: CreateAlarmInput = {
      time: t,
      label: l,
      repeatPattern: repeatPattern(),
      repeatDays: repeatPattern() === "custom" ? repeatDays() : null,
      enabled: true,
    };

    if (creating()) {
      await createAlarm(input);
    } else if (editing()) {
      await updateAlarm(editing()!, input);
    }
    resetForm();
  }

  async function handleDelete(id: string) {
    await deleteAlarm(id);
    if (editing() === id) resetForm();
  }

  async function handleToggle(alarm: Alarm) {
    await updateAlarm(alarm.id, { enabled: !alarm.enabled });
  }

  function toggleDay(day: number) {
    setRepeatDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      return [...prev, day].sort();
    });
  }

  return (
    <div style={{ height: "100%", overflow: "auto", "overflow-x": "hidden", padding: "24px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <div>
          <h2 style={{ margin: "0", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
            Alarmes
          </h2>
          <p style={{ margin: "4px 0 0", "font-size": "12px", color: "var(--text-muted)" }}>
            {alarms().length} alarme{alarms().length !== 1 ? "s" : ""}
          </p>
        </div>
        <Show when={!creating() && !editing()}>
          <Button variant="primary" size="sm" onClick={startCreate}>
            + Nouvelle alarme
          </Button>
        </Show>
      </div>

      {/* Create/Edit form */}
      <Show when={creating() || editing()}>
        <div style={{
          "margin-bottom": "20px",
          padding: "16px",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--accent-color)",
          background: "var(--bg-elevated)",
        }}>
          <div style={{ display: "flex", gap: "12px", "margin-bottom": "12px", "flex-wrap": "wrap" }}>
            <div style={{ width: "140px", "flex-shrink": "0" }}>
              <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Heure</label>
              <input
                type="time"
                value={time()}
                onInput={(e) => setTime(e.currentTarget.value)}
                style={{ ...inputStyle, "font-size": "16px", "font-weight": "600" }}
              />
            </div>
            <div style={{ flex: "1", "min-width": "150px" }}>
              <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Libelle</label>
              <input
                type="text"
                value={label()}
                onInput={(e) => setLabel(e.currentTarget.value)}
                placeholder="Reveil, Reunion..."
                style={inputStyle}
              />
            </div>
          </div>

          {/* Repeat pattern */}
          <div style={{ "margin-bottom": "12px", position: "relative" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Repetition</label>
            <button
              type="button"
              onClick={() => setRepeatDropdownOpen(!repeatDropdownOpen())}
              style={{
                ...inputStyle,
                cursor: "pointer",
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                height: "34px",
              }}
            >
              <span>{REPEAT_OPTIONS.find((o) => o.value === repeatPattern())?.label ?? repeatPattern()}</span>
              <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>&#9660;</span>
            </button>
            <Show when={repeatDropdownOpen()}>
              <div onClick={() => setRepeatDropdownOpen(false)} style={{ position: "fixed", inset: "0", "z-index": "99" }} />
              <div style={{
                position: "absolute",
                top: "100%",
                left: "0",
                right: "0",
                "margin-top": "4px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                "border-radius": "var(--radius-md)",
                "box-shadow": "0 4px 12px rgba(0,0,0,0.15)",
                "z-index": "100",
                overflow: "hidden",
              }}>
                <For each={REPEAT_OPTIONS}>
                  {(option) => (
                    <button
                      type="button"
                      onClick={() => { setRepeatPattern(option.value); setRepeatDropdownOpen(false); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "8px 12px",
                        border: "none",
                        background: repeatPattern() === option.value ? "var(--accent-color)" : "transparent",
                        color: repeatPattern() === option.value ? "#fff" : "var(--text-primary)",
                        "font-size": "13px",
                        cursor: "pointer",
                        "text-align": "left",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => { if (repeatPattern() !== option.value) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                      onMouseLeave={(e) => { if (repeatPattern() !== option.value) e.currentTarget.style.background = "transparent"; }}
                    >{option.label}</button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Custom days */}
          <Show when={repeatPattern() === "custom"}>
            <div style={{ "margin-bottom": "12px" }}>
              <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "6px" }}>Jours</label>
              <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
                {/* Display Mon-Sun order: 1,2,3,4,5,6,0 */}
                <For each={[1, 2, 3, 4, 5, 6, 0]}>
                  {(day) => (
                    <button
                      type="button"
                      onClick={() => toggleDay(day)}
                      style={{
                        padding: "4px 10px",
                        "border-radius": "var(--radius-sm)",
                        "font-size": "12px",
                        cursor: "pointer",
                        border: "1px solid var(--border-color)",
                        background: repeatDays().includes(day) ? "var(--accent-color)" : "var(--bg-surface)",
                        color: repeatDays().includes(day) ? "#fff" : "var(--text-secondary)",
                        transition: "background 0.1s",
                      }}
                    >{DAY_LABELS[day]}</button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <div style={{ display: "flex", "align-items": "center", "justify-content": "flex-end", gap: "8px", "margin-top": "4px" }}>
            <Button variant="ghost" size="sm" onClick={resetForm}>Annuler</Button>
            <Button variant="primary" size="sm" onClick={handleSave}>{creating() ? "Creer" : "Enregistrer"}</Button>
          </div>
        </div>
      </Show>

      {/* Alarm list */}
      <div style={{ display: "flex", "flex-direction": "column", "min-width": "0" }}>
        {/* Table header */}
        <div style={{
          display: "flex", "align-items": "center", padding: "8px 12px",
          "font-size": "11px", "font-weight": "600", color: "var(--text-muted)", "text-transform": "uppercase",
          "border-bottom": "2px solid var(--border-color)",
        }}>
          <span style={{ width: "80px", "flex-shrink": "0" }}>Heure</span>
          <span style={{ flex: "2", "min-width": "0" }}>Libelle</span>
          <span style={{ flex: "1", "min-width": "0" }}>Repetition</span>
          <span style={{ width: "60px", "flex-shrink": "0", "text-align": "center" }}>Actif</span>
          <span style={{ width: "80px", "flex-shrink": "0", "text-align": "right" }} />
        </div>

        <For each={alarms()}>
          {(alarm) => (
            <div
              style={{
                display: "flex", "align-items": "center", padding: "10px 12px",
                "border-bottom": "1px solid var(--border-color)",
                background: editing() === alarm.id ? "var(--bg-elevated)" : "transparent",
                opacity: alarm.enabled ? "1" : "0.5",
                transition: "background 0.1s, opacity 0.15s",
              }}
              onMouseEnter={(e) => { if (editing() !== alarm.id) e.currentTarget.style.background = "var(--bg-surface)"; }}
              onMouseLeave={(e) => { if (editing() !== alarm.id) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ width: "80px", "flex-shrink": "0", "font-size": "18px", "font-weight": "700", color: "var(--text-primary)", "font-variant-numeric": "tabular-nums" }}>
                {alarm.time}
              </span>
              <span style={{ flex: "2", "min-width": "0", "font-size": "13px", "font-weight": "500", color: "var(--text-primary)", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis", "padding-right": "8px" }}>
                {alarm.label}
              </span>
              <span style={{ flex: "1", "min-width": "0" }}>
                <span style={{
                  padding: "2px 8px",
                  "font-size": "10px",
                  "border-radius": "var(--radius-sm)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  "white-space": "nowrap",
                }}>
                  {formatRepeatDisplay(alarm)}
                </span>
              </span>
              <span style={{ width: "60px", "flex-shrink": "0", display: "flex", "justify-content": "center" }}>
                <button
                  onClick={() => handleToggle(alarm)}
                  title={alarm.enabled ? "Desactiver" : "Activer"}
                  style={{
                    width: "36px",
                    height: "20px",
                    "border-radius": "10px",
                    border: "none",
                    cursor: "pointer",
                    background: alarm.enabled ? "var(--accent-color)" : "var(--bg-elevated)",
                    position: "relative",
                    transition: "background 0.2s",
                    "flex-shrink": "0",
                  }}
                >
                  <span style={{
                    position: "absolute",
                    top: "2px",
                    left: alarm.enabled ? "18px" : "2px",
                    width: "16px",
                    height: "16px",
                    "border-radius": "50%",
                    background: "#fff",
                    transition: "left 0.2s",
                    "box-shadow": "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
              </span>
              <span style={{ width: "80px", "flex-shrink": "0", display: "flex", gap: "4px", "justify-content": "flex-end" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(alarm); }}
                  title="Editer"
                  style={{ background: "none", border: "none", cursor: "pointer", "font-size": "16px", color: "var(--text-muted)", padding: "2px", "border-radius": "var(--radius-sm)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  &#9998;
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(alarm.id); }}
                  title="Supprimer"
                  style={{ background: "none", border: "none", cursor: "pointer", "font-size": "16px", color: "var(--text-muted)", padding: "2px", "border-radius": "var(--radius-sm)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--danger-color, #e74c3c)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-muted)"; }}
                >
                  &#10005;
                </button>
              </span>
            </div>
          )}
        </For>
      </div>

      <Show when={alarms().length === 0}>
        <div style={{ "font-size": "13px", color: "var(--text-muted)", padding: "40px 0", "text-align": "center" }}>
          Aucune alarme. Cliquez sur "+ Nouvelle alarme" pour commencer.
        </div>
      </Show>
    </div>
  );
}
