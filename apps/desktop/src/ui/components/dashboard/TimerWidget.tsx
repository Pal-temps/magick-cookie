import { Show, For, createSignal, onMount } from "solid-js";
import { useTimerStore } from "../../../application/stores/timerStore";
import { useTaskStore } from "../../../application/stores/taskStore";
import { useProjectStore } from "../../../application/stores/projectStore";
import { Button } from "../common/Button";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerWidget() {
  const {
    timerMode, timerState, remainingSeconds, totalSeconds, pomodoroCount,
    pomodoroSettings, startPomodoro, startFreeTimer, pause, resume, stop, acknowledgeBreak,
    selectedTaskId, selectedTaskTitle, selectTask,
    selectedProjectId, setSelectedProjectId,
    awaitingNote, sessionNote, setSessionNote, submitNote, skipNote,
  } = useTimerStore();

  const { tasks, fetchTasks } = useTaskStore();
  const { projects } = useProjectStore();

  const [freeMinutes, setFreeMinutes] = createSignal(25);

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
      case "focus": return "Focus";
      case "break": return "Pause";
      case "waiting": return "Cliquez pour la pause";
      case "paused": return "En pause";
      default: return "";
    }
  };

  return (
    <div>
      {/* Session note prompt */}
      <Show when={awaitingNote()}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
          <div style={{ "font-size": "12px", color: "var(--text-secondary)", "font-weight": "500" }}>
            Note de session (optionnel)
          </div>
          <textarea
            value={sessionNote()}
            onInput={(e) => setSessionNote(e.currentTarget.value)}
            placeholder="Qu'avez-vous fait ? Blocages ?"
            rows={3}
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
            }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="primary" size="sm" onClick={submitNote} style={{ flex: "1" }}>
              Sauver
            </Button>
            <Button variant="secondary" size="sm" onClick={skipNote} style={{ flex: "1" }}>
              Passer
            </Button>
          </div>
        </div>
      </Show>

      <Show when={!awaitingNote() && timerState() === "idle"}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
          {/* Project selector */}
          <Show when={projects().length > 0}>
            <select
              value={selectedProjectId() ?? ""}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
              style={{
                padding: "6px 8px",
                "border-radius": "var(--radius-md)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                "font-size": "12px",
                width: "100%",
              }}
            >
              <option value="">-- Aucun projet --</option>
              <For each={projects()}>
                {(project) => (
                  <option value={project.id} style={{ color: project.color }}>
                    {project.name}
                  </option>
                )}
              </For>
            </select>
          </Show>

          {/* Task selector */}
          <select
            value={selectedTaskId() ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                selectTask(null, null);
              } else {
                const task = tasks().find((t) => t.id === val);
                selectTask(val, task?.title ?? null);
              }
            }}
            style={{
              padding: "6px 8px",
              "border-radius": "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              "font-size": "12px",
              width: "100%",
            }}
          >
            <option value="">-- Aucune tache --</option>
            <For each={tasks()}>
              {(task) => <option value={task.id}>{task.title}</option>}
            </For>
          </select>

          <Button variant="primary" onClick={startPomodoro}>
            Pomodoro (25/5/15)
          </Button>
          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <input
              type="number"
              min="1"
              max="180"
              value={freeMinutes()}
              onInput={(e) => setFreeMinutes(Number(e.target.value))}
              style={{
                width: "60px",
                padding: "4px 8px",
                "border-radius": "var(--radius-md)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                "font-size": "13px",
                "text-align": "center",
              }}
            />
            <Button variant="secondary" onClick={() => startFreeTimer(freeMinutes())} style={{ flex: "1" }}>
              Timer libre
            </Button>
          </div>
        </div>
      </Show>

      <Show when={timerState() !== "idle"}>
        <div style={{ "text-align": "center" }}>
          {/* Circular progress */}
          <div style={{ position: "relative", width: "140px", height: "140px", margin: "0 auto 16px" }}>
            <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
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
              <div style={{ "font-size": "28px", "font-weight": "700", color: "var(--text-primary)", "font-variant-numeric": "tabular-nums" }}>
                {formatTime(remainingSeconds())}
              </div>
              <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "2px" }}>
                {stateLabel()}
              </div>
            </div>
          </div>

          <Show when={selectedTaskTitle()}>
            <div style={{ "font-size": "11px", color: "var(--accent-primary)", "margin-bottom": "4px", "max-width": "200px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", margin: "0 auto 4px" }}>
              {selectedTaskTitle()}
            </div>
          </Show>

          <Show when={timerMode() === "pomodoro"}>
            <div style={{ "font-size": "12px", color: "var(--text-muted)", "margin-bottom": "12px" }}>
              Session {pomodoroCount() + 1}/{pomodoroSettings().sessionsBeforeLong}
            </div>
          </Show>

          <div style={{ display: "flex", gap: "8px", "justify-content": "center" }}>
            <Show when={timerState() === "waiting"}>
              <Button variant="primary" size="sm" onClick={acknowledgeBreak}>Lancer la pause</Button>
            </Show>
            <Show when={timerState() === "focus" || timerState() === "break"}>
              <Button variant="secondary" size="sm" onClick={pause}>Pause</Button>
            </Show>
            <Show when={timerState() === "paused"}>
              <Button variant="primary" size="sm" onClick={resume}>Reprendre</Button>
            </Show>
            <Button variant="danger" size="sm" onClick={stop}>Arreter</Button>
          </div>
        </div>
      </Show>
    </div>
  );
}
