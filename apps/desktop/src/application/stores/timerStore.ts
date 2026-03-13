import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import { notify } from "../../infrastructure/tauri/notifications";
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
    await saveSession(true);
    const count = pomodoroCount() + 1;
    setPomodoroCount(count);

    const settings = pomodoroSettings();
    const isLongBreak = count % settings.sessionsBeforeLong === 0;
    const breakMin = isLongBreak ? settings.longBreakMin : settings.shortBreakMin;

    await notify(
      "Pomodoro termine !",
      isLongBreak
        ? `Session ${count} terminee. Longue pause de ${breakMin} min.`
        : `Session ${count} terminee. Pause de ${breakMin} min.`,
    );

    setTimerState("break");
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
    startTickInterval();
  } else if (mode === "free") {
    await saveSession(true);
    await notify("Timer termine !", "Votre session de travail est terminee.");
    setTimerState("idle");
    setTimerMode(null);
  }
}

async function saveSession(completed: boolean) {
  if (!sessionStartedAt || !timerMode()) return;

  const now = new Date();
  const actualSecs = Math.round((now.getTime() - sessionStartedAt.getTime()) / 1000);

  try {
    await api.post("/timer-sessions", {
      mode: timerMode(),
      durationMinutes: Math.round(totalSeconds() / 60),
      actualSeconds: actualSecs,
      startedAt: sessionStartedAt.toISOString(),
      endedAt: now.toISOString(),
      completed,
    });
    await fetchTodayStats();
  } catch (e) {
    console.error("Failed to save timer session:", e);
  }

  sessionStartedAt = null;
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
  function startPomodoro() {
    const secs = pomodoroSettings().focusMin * 60;
    setTimerMode("pomodoro");
    setTimerState("focus");
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    setPomodoroCount(0);
    sessionStartedAt = new Date();
    startTickInterval();
  }

  function startFreeTimer(minutes: number) {
    const secs = minutes * 60;
    setTimerMode("free");
    setTimerState("focus");
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    sessionStartedAt = new Date();
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
      await saveSession(false);
    }
    setTimerState("idle");
    setTimerMode(null);
    setRemainingSeconds(0);
    setTotalSeconds(0);
  }

  return {
    timerMode,
    timerState,
    remainingSeconds,
    totalSeconds,
    pomodoroCount,
    pomodoroSettings,
    todayStats,
    startPomodoro,
    startFreeTimer,
    pause,
    resume,
    stop,
    fetchTodayStats,
  };
}
