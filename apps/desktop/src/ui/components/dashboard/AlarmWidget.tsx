import { createSignal, For, Show } from "solid-js";
import { useAlarmStore, type Alarm, type CreateAlarmInput } from "../../../application/stores/alarmStore";
import { Button } from "../common/Button";
import { SOUND_OPTIONS, playSound, type SoundName } from "../../../infrastructure/audio/soundPlayer";
import { useT } from "../../../i18n/context";

const REPEAT_LABEL_KEYS: Record<string, string> = {
  once: "dashboard.once",
  daily: "dashboard.daily",
  weekdays: "dashboard.weekdays",
  weekends: "dashboard.weekends",
  custom: "Custom",
};

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

export function AlarmWidget() {
  const { alarms, createAlarm, updateAlarm, deleteAlarm } = useAlarmStore();
  const { t } = useT();

  function formatRepeat(alarm: Alarm): string {
    if (alarm.repeatPattern === "custom" && alarm.repeatDays) {
      return alarm.repeatDays.map((d) => DAY_LABELS[d]).join("");
    }
    const key = REPEAT_LABEL_KEYS[alarm.repeatPattern];
    return key ? t(key) : alarm.repeatPattern;
  }
  const [showForm, setShowForm] = createSignal(false);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);
  const [time, setTime] = createSignal("08:00");
  const [label, setLabel] = createSignal("");
  const [repeat, setRepeat] = createSignal<Alarm["repeatPattern"]>("once");
  const [sound, setSound] = createSignal<string>("alarm");

  const inputStyle = {
    padding: "4px 8px",
    "border-radius": "var(--radius-md)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    "font-size": "12px",
    outline: "none",
  };

  function toggleExpand(id: string) {
    setExpandedId(expandedId() === id ? null : id);
  }

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
      alertSound: sound(),
    };
    await createAlarm(input);
    setTime("08:00");
    setLabel("");
    setRepeat("once");
    setSound("alarm");
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
          {showForm() ? t("common.cancel") : `+ ${t("common.add")}`}
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
              placeholder={t("dashboard.labelPlaceholder")}
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
              <option value="once">{t("dashboard.once")}</option>
              <option value="daily">{t("dashboard.daily")}</option>
              <option value="weekdays">{t("dashboard.weekdays")}</option>
              <option value="weekends">{t("dashboard.weekends")}</option>
            </select>
            <select
              value={sound()}
              onChange={(e) => setSound(e.currentTarget.value)}
              style={{ ...inputStyle, flex: "1", cursor: "pointer" }}
            >
              <For each={SOUND_OPTIONS}>
                {(s) => <option value={s.value}>{s.label}</option>}
              </For>
            </select>
            <button
              type="button"
              onClick={() => playSound(sound() as SoundName)}
              title={t("dashboard.listen")}
              style={{
                background: "none", border: "1px solid var(--border-color)", cursor: "pointer",
                "border-radius": "var(--radius-md)", padding: "3px 8px", "font-size": "14px",
                color: "var(--text-secondary)",
              }}
            >&#9654;</button>
            <Button variant="primary" size="sm" onClick={handleCreate} style={{ "margin-left": "auto" }}>
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Show>

      <Show when={alarms().length === 0}>
        <div style={{ "font-size": "12px", color: "var(--text-muted)" }}>{t("dashboard.noAlarm")}</div>
      </Show>

      <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
        <For each={alarms()}>
          {(alarm) => (
            <div
              class="widget-row"
              classList={{ "widget-row--expanded": expandedId() === alarm.id }}
              style={{
                background: alarm.enabled ? "var(--bg-elevated)" : "transparent",
                opacity: alarm.enabled ? "1" : "0.5",
              }}
            >
              <span style={{
                "font-size": "16px",
                "font-weight": "700",
                color: "var(--text-primary)",
                "font-variant-numeric": "tabular-nums",
                "min-width": "50px",
                "flex-shrink": "0",
              }}>
                {alarm.time}
              </span>
              <div class="widget-row-content">
                <div style={{
                  "font-size": "12px",
                  color: "var(--text-primary)",
                  "white-space": "nowrap",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                }}>
                  {alarm.label}
                </div>
                <div class="widget-row-meta widget-row-detail">
                  <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>
                    {formatRepeat(alarm)}
                  </span>
                  <select
                    value={alarm.alertSound ?? "alarm"}
                    onChange={(e) => updateAlarm(alarm.id, { alertSound: e.currentTarget.value })}
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
                    onClick={() => playSound((alarm.alertSound ?? "alarm") as SoundName)}
                    title={t("dashboard.listen")}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      "font-size": "11px", color: "var(--text-muted)", padding: "0",
                    }}
                  >&#9654;</button>
                </div>
              </div>
              <div class="widget-row-actions">
                <button
                  class="widget-row-expand"
                  onClick={() => toggleExpand(alarm.id)}
                  title={t("dashboard.options")}
                >
                  &#8943;
                </button>
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
                  class="widget-row-delete"
                  onClick={() => deleteAlarm(alarm.id)}
                  title={t("common.delete")}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-muted)", "font-size": "13px", padding: "0 2px",
                    "line-height": "1",
                  }}
                >
                  &times;
                </button>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
