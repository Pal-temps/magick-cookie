import { createSignal, For, Show } from "solid-js";
import { useAlarmStore, type Alarm, type CreateAlarmInput } from "../../../application/stores/alarmStore";
import { Button } from "../common/Button";

const REPEAT_LABELS: Record<string, string> = {
  once: "1x",
  daily: "Quotidien",
  weekdays: "L-V",
  weekends: "S-D",
  custom: "Custom",
};

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

function formatRepeat(alarm: Alarm): string {
  if (alarm.repeatPattern === "custom" && alarm.repeatDays) {
    return alarm.repeatDays.map((d) => DAY_LABELS[d]).join("");
  }
  return REPEAT_LABELS[alarm.repeatPattern] ?? alarm.repeatPattern;
}

export function AlarmWidget() {
  const { alarms, createAlarm, updateAlarm, deleteAlarm } = useAlarmStore();
  const [showForm, setShowForm] = createSignal(false);
  const [time, setTime] = createSignal("08:00");
  const [label, setLabel] = createSignal("");
  const [repeat, setRepeat] = createSignal<Alarm["repeatPattern"]>("once");

  const inputStyle = {
    padding: "4px 8px",
    "border-radius": "var(--radius-md)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    "font-size": "12px",
    outline: "none",
  };

  async function handleCreate() {
    const t = time().trim();
    const l = label().trim();
    if (!t || !l) return;
    const input: CreateAlarmInput = {
      time: t,
      label: l,
      repeatPattern: repeat(),
      repeatDays: null,
      enabled: true,
    };
    await createAlarm(input);
    setTime("08:00");
    setLabel("");
    setRepeat("once");
    setShowForm(false);
  }

  return (
    <div>
      <div style={{ display: "flex", "justify-content": "flex-end", "margin-bottom": "6px" }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowForm(!showForm())}
          style={{ "font-size": "12px", padding: "2px 8px" }}
        >
          {showForm() ? "Annuler" : "+ Ajouter"}
        </Button>
      </div>

      <Show when={showForm()}>
        <div style={{
          display: "flex", "flex-direction": "column", gap: "6px",
          padding: "8px", "border-radius": "var(--radius-md)",
          background: "var(--bg-elevated)", "margin-bottom": "8px",
        }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type="time"
              value={time()}
              onInput={(e) => setTime(e.currentTarget.value)}
              style={{ ...inputStyle, width: "100px", "font-weight": "600" }}
            />
            <input
              type="text"
              placeholder="Libelle..."
              value={label()}
              onInput={(e) => setLabel(e.currentTarget.value)}
              style={{ ...inputStyle, flex: "1" }}
            />
          </div>
          <div style={{ display: "flex", gap: "6px", "align-items": "center" }}>
            <select
              value={repeat()}
              onChange={(e) => setRepeat(e.currentTarget.value as Alarm["repeatPattern"])}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="once">Une fois</option>
              <option value="daily">Quotidien</option>
              <option value="weekdays">Lun-Ven</option>
              <option value="weekends">Sam-Dim</option>
            </select>
            <Button variant="primary" size="sm" onClick={handleCreate} style={{ "margin-left": "auto" }}>
              Creer
            </Button>
          </div>
        </div>
      </Show>

      <Show when={alarms().length === 0}>
        <div style={{ "font-size": "12px", color: "var(--text-muted)" }}>Aucune alarme</div>
      </Show>

      <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
        <For each={alarms()}>
          {(alarm) => (
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "6px 8px",
              "border-radius": "var(--radius-md)",
              background: alarm.enabled ? "var(--bg-elevated)" : "transparent",
              opacity: alarm.enabled ? "1" : "0.5",
            }}>
              <span style={{
                "font-size": "16px",
                "font-weight": "700",
                color: "var(--text-primary)",
                "font-variant-numeric": "tabular-nums",
                "min-width": "50px",
              }}>
                {alarm.time}
              </span>
              <div style={{ flex: "1", "min-width": "0" }}>
                <div style={{
                  "font-size": "12px",
                  color: "var(--text-primary)",
                  "white-space": "nowrap",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                }}>
                  {alarm.label}
                </div>
                <div style={{ "font-size": "10px", color: "var(--text-muted)" }}>
                  {formatRepeat(alarm)}
                </div>
              </div>
              <button
                onClick={() => updateAlarm(alarm.id, { enabled: !alarm.enabled })}
                style={{
                  width: "32px",
                  height: "18px",
                  "border-radius": "9px",
                  border: "none",
                  cursor: "pointer",
                  background: alarm.enabled ? "var(--accent-primary)" : "var(--border-color)",
                  position: "relative",
                  transition: "background 0.2s",
                  "flex-shrink": "0",
                }}
              >
                <span style={{
                  position: "absolute",
                  top: "2px",
                  left: alarm.enabled ? "16px" : "2px",
                  width: "14px",
                  height: "14px",
                  "border-radius": "50%",
                  background: "white",
                  transition: "left 0.2s",
                }} />
              </button>
              <button
                onClick={() => deleteAlarm(alarm.id)}
                title="Supprimer"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", "font-size": "13px", padding: "0 2px",
                  "line-height": "1",
                }}
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
