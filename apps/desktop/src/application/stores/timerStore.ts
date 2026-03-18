import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import { notify } from "../../infrastructure/tauri/notifications";
import { playSound } from "../../infrastructure/audio/soundPlayer";
import type { TimerStats } from "../../domain/models/TimerSession";

export type TimerMode = "pomodoro" | "free";
export type TimerState = "idle" | "focus" | "paused" | "break";

export interface PomodoroSettings {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  sessionsBeforeLong: number;
}

const DEFAULT_POMODORO: PomodoroSettings = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  sessionsBeforeLong: 4,
};

const [timerMode, setTimerMode] = createSignal<TimerMode | null>(null);
const [timerState, setTimerState] = createSignal<TimerState>("idle");
const [remainingSeconds, setRemainingSeconds] = createSignal(0);
const [totalSeconds, setTotalSeconds] = createSignal(0);
const [pomodoroCount, setPomodoroCount] = createSignal(0);
const [pomodoroSettings] = createSignal<PomodoroSettings>(DEFAULT_POMODORO);
const [todayStats, setTodayStats] = createSignal<TimerStats>({ totalSeconds: 0, sessionCount: 0 });
const [selectedTaskId, setSelectedTaskId] = createSignal<string | null>(null);
const [selectedTaskTitle, setSelectedTaskTitle] = createSignal<string | null>(null);
const [isFocusMode, setIsFocusMode] = createSignal(false);
const [focusModeEnabled, setFocusModeEnabled] = createSignal(
  localStorage.getItem("magick-cookie-focus-mode") !== "false"
);

// Project selection
const [selectedProjectId, setSelectedProjectId] = createSignal<string | null>(null);

// Session note signals
const [awaitingNote, setAwaitingNote] = createSignal(false);
const [sessionNote, setSessionNote] = createSignal("");

// Pending session data (saved when awaiting note)
let pendingSession: {
  mode: string;
  durationMinutes: number;
  actualSeconds: number;
  startedAt: string;
  endedAt: string;
  completed: boolean;
  taskId: string | null;
  projectId: string | null;
} | null = null;

let intervalId: ReturnType<typeof setInterval> | null = null;
let sessionStartedAt: Date | null = null;

function clearTickInterval() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function tick() {
  const remaining = remainingSeconds();
  if (remaining <= 0) {
    clearTickInterval();
    onTimerComplete();
    return;
  }
  setRemainingSeconds(remaining - 1);
}

function startTickInterval() {
  clearTickInterval();
  intervalId = setInterval(tick, 1000);
}

async function onTimerComplete() {
  const mode = timerMode();
  const state = timerState();

  if (mode === "pomodoro" && state === "focus") {
    // Auto-save completed pomodoro sessions (no note prompt for auto-complete)
    await saveSession(true);
    const count = pomodoroCount() + 1;
    setPomodoroCount(count);

    const settings = pomodoroSettings();
    const isLongBreak = count % settings.sessionsBeforeLong === 0;
    const breakMin = isLongBreak ? settings.longBreakMin : settings.shortBreakMin;

    playSound("focusEnd");
    await notify(
      "Pomodoro termine !",
      isLongBreak
        ? `Session ${count} terminee. Longue pause de ${breakMin} min.`
        : `Session ${count} terminee. Pause de ${breakMin} min.`,
      { silent: true },
    );

    setTimerState("break");
    setIsFocusMode(false);
    const secs = breakMin * 60;
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    startTickInterval();
  } else if (mode === "pomodoro" && state === "break") {
    await notify("Pause terminee !", "C'est reparti pour une session de focus.");

    setTimerState("focus");
    const secs = pomodoroSettings().focusMin * 60;
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    sessionStartedAt = new Date();
    if (focusModeEnabled()) setIsFocusMode(true);
    startTickInterval();
  } else if (mode === "free") {
    await saveSession(true);
    await notify("Timer termine !", "Votre session de travail est terminee.");
    setTimerState("idle");
    setTimerMode(null);
    setIsFocusMode(false);
  }
}

async function saveSession(completed: boolean, label?: string | null) {
  if (!sessionStartedAt || !timerMode()) return;

  const now = new Date();
  const actualSecs = Math.round((now.getTime() - sessionStartedAt.getTime()) / 1000);

  const taskId = selectedTaskId();
  const projectId = selectedProjectId();
  try {
    await api.post("/timer-sessions", {
      mode: timerMode(),
      durationMinutes: Math.round(totalSeconds() / 60),
      actualSeconds: actualSecs,
      startedAt: sessionStartedAt.toISOString(),
      endedAt: now.toISOString(),
      completed,
      ...(label ? { label } : {}),
      ...(taskId ? { taskId } : {}),
      ...(projectId ? { projectId } : {}),
    });
    await fetchTodayStats();
  } catch (e) {
    console.error("Failed to save timer session:", e);
  }

  sessionStartedAt = null;
}

function buildPendingSession(completed: boolean) {
  if (!sessionStartedAt || !timerMode()) return;
  const now = new Date();
  const actualSecs = Math.round((now.getTime() - sessionStartedAt.getTime()) / 1000);
  pendingSession = {
    mode: timerMode()!,
    durationMinutes: Math.round(totalSeconds() / 60),
    actualSeconds: actualSecs,
    startedAt: sessionStartedAt.toISOString(),
    endedAt: now.toISOString(),
    completed,
    taskId: selectedTaskId(),
    projectId: selectedProjectId()
  };
  sessionStartedAt = null;
}

async function savePendingSession(label: string | null) {
  if (!pendingSession) return;
  try {
    await api.post("/timer-sessions", {
      ...pendingSession,
      ...(label ? { label } : {}),
    });
    await fetchTodayStats();
  } catch (e) {
    console.error("Failed to save timer session:", e);
  }
  pendingSession = null;
}

async function fetchTodayStats() {
  try {
    const stats = await api.get<TimerStats>("/timer-sessions/stats/today");
    setTodayStats(stats);
  } catch (e) {
    console.error("Failed to fetch today stats:", e);
  }
}

export function useTimerStore() {
  function selectTask(taskId: string | null, taskTitle: string | null) {
    setSelectedTaskId(taskId);
    setSelectedTaskTitle(taskTitle);
  }

  function startPomodoro() {
    const secs = pomodoroSettings().focusMin * 60;
    setTimerMode("pomodoro");
    setTimerState("focus");
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    setPomodoroCount(0);
    sessionStartedAt = new Date();
    if (focusModeEnabled()) setIsFocusMode(true);
    startTickInterval();
  }

  function startFreeTimer(minutes: number) {
    const secs = minutes * 60;
    setTimerMode("free");
    setTimerState("focus");
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    sessionStartedAt = new Date();
    if (focusModeEnabled()) setIsFocusMode(true);
    startTickInterval();
  }

  function pause() {
    if (timerState() === "focus" || timerState() === "break") {
      clearTickInterval();
      setTimerState("paused");
    }
  }

  function resume() {
    if (timerState() === "paused") {
      setTimerState("focus");
      startTickInterval();
    }
  }

  async function stop() {
    clearTickInterval();
    if (timerState() !== "idle" && sessionStartedAt) {
      // Build pending session and show note prompt
      buildPendingSession(false);
      setTimerState("idle");
      setTimerMode(null);
      setRemainingSeconds(0);
      setTotalSeconds(0);
      setIsFocusMode(false);
      setSessionNote("");
      setAwaitingNote(true);
      return;
    }
    setTimerState("idle");
    setTimerMode(null);
    setRemainingSeconds(0);
    setTotalSeconds(0);
    setSelectedTaskId(null);
    setSelectedTaskTitle(null);
    setSelectedProjectId(null);
    setIsFocusMode(false);
  }

  async function submitNote() {
    const note = sessionNote().trim();
    await savePendingSession(note || null);
    setAwaitingNote(false);
    setSessionNote("");
    setSelectedTaskId(null);
    setSelectedTaskTitle(null);
    setSelectedProjectId(null);
  }

  async function skipNote() {
    await savePendingSession(null);
    setAwaitingNote(false);
    setSessionNote("");
    setSelectedTaskId(null);
    setSelectedTaskTitle(null);
    setSelectedProjectId(null);
  }

  function toggleFocusMode() {
    setIsFocusMode(!isFocusMode());
  }

  function setFocusModePreference(enabled: boolean) {
    setFocusModeEnabled(enabled);
    localStorage.setItem("magick-cookie-focus-mode", String(enabled));
  }

  return {
    timerMode,
    timerState,
    remainingSeconds,
    totalSeconds,
    pomodoroCount,
    pomodoroSettings,
    todayStats,
    selectedTaskId,
    selectedTaskTitle,
    selectedProjectId,
    setSelectedProjectId,
    isFocusMode,
    focusModeEnabled,
    awaitingNote,
    sessionNote,
    setSessionNote,
    selectTask,
    startPomodoro,
    startFreeTimer,
    pause,
    resume,
    stop,
    submitNote,
    skipNote,
    toggleFocusMode,
    setFocusModePreference,
    fetchTodayStats,
  };
}
