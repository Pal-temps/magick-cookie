import { Show, For, onMount, createSignal } from "solid-js";
import { useTimerStore } from "../../../application/stores/timerStore";
import { useTaskStore } from "../../../application/stores/taskStore";
import { useProjectStore } from "../../../application/stores/projectStore";
import { Button } from "../common/Button";
import { SOUND_OPTIONS, playSound, type SoundName } from "../../../infrastructure/audio/soundPlayer";
import { useT } from "../../../i18n/context";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const selectStyle = {
  padding: "5px 8px",
  "border-radius": "var(--radius-md)",
  border: "1px solid var(--border-color)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  "font-size": "12px",
  flex: "1",
  "min-width": "0",
};

const inputStyle = {
  padding: "5px 8px",
  "border-radius": "var(--radius-md)",
  border: "1px solid var(--border-color)",
  background: "var(--bg-base)",
  color: "var(--text-primary)",
  "font-size": "12px",
  width: "50px",
  "text-align": "center" as const,
};

const labelStyle = {
  "font-size": "10px",
  color: "var(--text-muted)",
  "margin-bottom": "3px",
};

export function TimerWidget() {
  const {
    timerMode, timerState, remainingSeconds, totalSeconds, pomodoroCount,
    pomodoroSettings, setPomodoroSettings, startPomodoro, pause, resume, stop, dismissSound, startBreak,
    selectedTaskId, selectedTaskTitle, selectTask,
    selectedProjectId, setSelectedProjectId,
    awaitingNote, sessionNote, setSessionNote, submitNote, skipNote,
  } = useTimerStore();

  const { tasks, fetchTasks } = useTaskStore();
  const { projects } = useProjectStore();
  const { t } = useT();
  const [showSettings, setShowSettings] = createSignal(false);

  onMount(() => {
    if (tasks().length === 0) fetchTasks();
  });

  const progress = () => {
    const total = totalSeconds();
    if (total === 0) return 0;
    return ((total - remainingSeconds()) / total) * 100;
  };

  const stateLabel = () => {
    switch (timerState()) {
      case "focus": return t("dashboard.focus");
      case "break": return t("dashboard.break");
      case "waiting": return t("dashboard.waitingForBreak");
      case "paused": return t("dashboard.paused");
      default: return "";
    }
  };

  function patchSettings(key: string, value: number) {
    setPomodoroSettings({ ...pomodoroSettings(), [key]: Math.max(1, value) });
  }

  // Gear icon button (reused)
  function GearButton() {
    return (
      <button
        onClick={() => setShowSettings(!showSettings())}
        title={t("dashboard.pomodoroSettings")}
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          width: "32px",
          height: "32px",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--border-color)",
          background: showSettings() ? "color-mix(in srgb, var(--accent-primary) 15%, transparent)" : "var(--bg-elevated)",
          color: showSettings() ? "var(--accent-primary)" : "var(--text-muted)",
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
    );
  }

  return (
    <div>
      {/* Session note prompt */}
      <Show when={awaitingNote()}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
          <div style={{ "font-size": "12px", color: "var(--text-secondary)", "font-weight": "500" }}>
            {t("dashboard.sessionNote")}
          </div>
          <textarea
            value={sessionNote()}
            onInput={(e) => setSessionNote(e.currentTarget.value)}
            placeholder={t("dashboard.sessionNotePlaceholder")}
            rows={2}
            style={{
              width: "100%",
              padding: "8px",
              "border-radius": "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              "font-size": "12px",
              resize: "vertical",
              "font-family": "inherit",
              "box-sizing": "border-box",
            }}
          />
          <div style={{ display: "flex", gap: "6px" }}>
            <Button variant="primary" size="sm" onClick={submitNote} style={{ flex: "1" }}>
              {t("common.save")}
            </Button>
            <Button variant="secondary" size="sm" onClick={skipNote} style={{ flex: "1" }}>
              {t("dashboard.skip")}
            </Button>
          </div>
        </div>
      </Show>

      {/* ─── Idle: start form ─── */}
      <Show when={!awaitingNote() && timerState() === "idle"}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
          {/* Selectors + gear */}
          <Show when={projects().length > 0}>
            <div style={{ display: "flex", gap: "6px" }}>
              <select
                value={selectedProjectId() ?? ""}
                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                style={selectStyle}
              >
                <option value="">{t("dashboard.projectOptional")}</option>
                <For each={projects()}>
                  {(project) => <option value={project.id}>{project.name}</option>}
                </For>
              </select>
              <GearButton />
            </div>
          </Show>

          <Show when={projects().length === 0}>
            <div style={{ display: "flex", gap: "6px" }}>
              <select
                value={selectedTaskId() ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) { selectTask(null, null); } else {
                    const task = tasks().find((t) => t.id === val);
                    selectTask(val, task?.title ?? null);
                  }
                }}
                style={selectStyle}
              >
                <option value="">{t("dashboard.taskOptional")}</option>
                <For each={tasks()}>
                  {(task) => <option value={task.id}>{task.title}</option>}
                </For>
              </select>
              <GearButton />
            </div>
          </Show>

          {/* Task selector (when projects exist, show separately without gear) */}
          <Show when={projects().length > 0}>
            <select
              value={selectedTaskId() ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) { selectTask(null, null); } else {
                  const task = tasks().find((t) => t.id === val);
                  selectTask(val, task?.title ?? null);
                }
              }}
              style={{ ...selectStyle, width: "100%" }}
            >
              <option value="">{t("dashboard.taskOptional")}</option>
              <For each={tasks()}>
                {(task) => <option value={task.id}>{task.title}</option>}
              </For>
            </select>
          </Show>

          {/* Settings panel */}
          <Show when={showSettings()}>
            <div style={{
              display: "flex", "flex-wrap": "wrap", gap: "8px",
              padding: "10px",
              "border-radius": "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-elevated)",
            }}>
              <div>
                <div style={labelStyle}>{t("dashboard.focus")}</div>
                <div style={{ display: "flex", "align-items": "center", gap: "3px" }}>
                  <input type="number" min="1" max="120" value={pomodoroSettings().focusMin} onChange={(e) => patchSettings("focusMin", Number(e.currentTarget.value))} style={inputStyle} />
                  <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>min</span>
                </div>
              </div>
              <div>
                <div style={labelStyle}>{t("dashboard.break")}</div>
                <div style={{ display: "flex", "align-items": "center", gap: "3px" }}>
                  <input type="number" min="1" max="60" value={pomodoroSettings().shortBreakMin} onChange={(e) => patchSettings("shortBreakMin", Number(e.currentTarget.value))} style={inputStyle} />
                  <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>min</span>
                </div>
              </div>
              <div>
                <div style={labelStyle}>{t("dashboard.longBreak")}</div>
                <div style={{ display: "flex", "align-items": "center", gap: "3px" }}>
                  <input type="number" min="1" max="60" value={pomodoroSettings().longBreakMin} onChange={(e) => patchSettings("longBreakMin", Number(e.currentTarget.value))} style={inputStyle} />
                  <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>min</span>
                </div>
              </div>
              <div>
                <div style={labelStyle}>{t("dashboard.sessions")}</div>
                <div style={{ display: "flex", "align-items": "center", gap: "3px" }}>
                  <input type="number" min="1" max="10" value={pomodoroSettings().sessionsBeforeLong} onChange={(e) => patchSettings("sessionsBeforeLong", Number(e.currentTarget.value))} style={inputStyle} />
                  <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>x</span>
                </div>
              </div>
              {/* Sounds */}
              <div style={{ width: "100%", display: "flex", gap: "8px", "flex-wrap": "wrap", "border-top": "1px solid var(--border-color)", "padding-top": "8px" }}>
                <div style={{ flex: "1", "min-width": "120px" }}>
                  <div style={labelStyle}>{t("dashboard.focusEndSound")}</div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <select
                      value={pomodoroSettings().focusEndSound}
                      onChange={(e) => setPomodoroSettings({ ...pomodoroSettings(), focusEndSound: e.currentTarget.value as SoundName })}
                      style={{ ...inputStyle, width: "auto", flex: "1", "text-align": "left", cursor: "pointer" }}
                    >
                      <For each={SOUND_OPTIONS}>{(s) => <option value={s.value}>{s.label}</option>}</For>
                    </select>
                    <button type="button" onClick={() => playSound(pomodoroSettings().focusEndSound)} title={t("dashboard.listen")} style={{ ...inputStyle, width: "auto", cursor: "pointer", "font-size": "12px" }}>&#9654;</button>
                  </div>
                </div>
                <div style={{ flex: "1", "min-width": "120px" }}>
                  <div style={labelStyle}>{t("dashboard.breakEndSound")}</div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <select
                      value={pomodoroSettings().breakEndSound}
                      onChange={(e) => setPomodoroSettings({ ...pomodoroSettings(), breakEndSound: e.currentTarget.value as SoundName })}
                      style={{ ...inputStyle, width: "auto", flex: "1", "text-align": "left", cursor: "pointer" }}
                    >
                      <For each={SOUND_OPTIONS}>{(s) => <option value={s.value}>{s.label}</option>}</For>
                    </select>
                    <button type="button" onClick={() => playSound(pomodoroSettings().breakEndSound)} title={t("dashboard.listen")} style={{ ...inputStyle, width: "auto", cursor: "pointer", "font-size": "12px" }}>&#9654;</button>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* Start button */}
          <Button variant="primary" onClick={startPomodoro} style={{ width: "100%", "font-size": "13px" }}>
            {t("dashboard.startTimer")} — {pomodoroSettings().focusMin}min
          </Button>
        </div>
      </Show>

      {/* ─── Running: timer display ─── */}
      <Show when={timerState() !== "idle" && !awaitingNote()}>
        <div style={{ "text-align": "center" }}>
          {/* Circular progress */}
          <div style={{ position: "relative", width: "110px", height: "110px", margin: "0 auto 10px" }}>
            <svg width="110" height="110" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="70" cy="70" r="62" fill="none" stroke="var(--border-color)" stroke-width="6" />
              <circle
                cx="70" cy="70" r="62" fill="none"
                stroke={timerState() === "waiting" ? "var(--cal-red, #e74c3c)" : timerState() === "break" ? "var(--cal-green)" : "var(--accent-primary)"}
                stroke-width="6"
                stroke-dasharray={`${2 * Math.PI * 62}`}
                stroke-dashoffset={`${2 * Math.PI * 62 * (1 - progress() / 100)}`}
                stroke-linecap="round"
              />
            </svg>
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              "text-align": "center",
            }}>
              <div style={{ "font-size": "24px", "font-weight": "700", color: "var(--text-primary)", "font-variant-numeric": "tabular-nums" }}>
                {formatTime(remainingSeconds())}
              </div>
              <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>
                {stateLabel()}
              </div>
            </div>
          </div>

          {/* Task name + session counter */}
          <Show when={selectedTaskTitle()}>
            <div style={{ "font-size": "11px", color: "var(--accent-primary)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "max-width": "100%", "margin-bottom": "2px" }}>
              {selectedTaskTitle()}
            </div>
          </Show>

          <Show when={timerMode() === "pomodoro"}>
            <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "10px" }}>
              {t("dashboard.session")} {pomodoroCount() + 1}/{pomodoroSettings().sessionsBeforeLong}
            </div>
          </Show>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "6px", "justify-content": "center", "flex-wrap": "wrap" }}>
            <Show when={timerState() === "waiting"}>
              <Button variant="ghost" size="sm" onClick={dismissSound}>🔇</Button>
              <Button variant="primary" size="sm" onClick={startBreak}>{t("dashboard.startBreak")}</Button>
            </Show>
            <Show when={timerState() === "focus" || timerState() === "break"}>
              <Button variant="secondary" size="sm" onClick={pause}>{t("dashboard.pause")}</Button>
            </Show>
            <Show when={timerState() === "paused"}>
              <Button variant="primary" size="sm" onClick={resume}>{t("dashboard.resume")}</Button>
            </Show>
            <Button variant="danger" size="sm" onClick={stop}>{t("dashboard.stop")}</Button>
          </div>
        </div>
      </Show>
    </div>
  );
}
