import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import type { DogWalk, DogWalkStats } from "../../domain/models/DogWalk";

const [activeWalk, setActiveWalk] = createSignal<DogWalk | null>(null);
const [elapsedSeconds, setElapsedSeconds] = createSignal(0);
const [todayStats, setTodayStats] = createSignal<DogWalkStats>({ totalSeconds: 0, walkCount: 0 });

let tickInterval: ReturnType<typeof setInterval> | null = null;

function startTicking(startedAt: string) {
  stopTicking();
  const startTime = new Date(startedAt).getTime();
  setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
  tickInterval = setInterval(() => {
    setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
  }, 1000);
}

function stopTicking() {
  if (tickInterval !== null) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

export function useDogWalkStore() {
  async function fetchActive() {
    const data = await api.get<DogWalk | null>("/dog-walks/active");
    setActiveWalk(data);
    if (data && !data.endedAt) {
      startTicking(data.startedAt);
    } else {
      stopTicking();
      setElapsedSeconds(0);
    }
  }

  async function startWalk() {
    try {
      const walk = await api.post<DogWalk>("/dog-walks/start", {});
      if (walk) {
        setActiveWalk(walk);
        startTicking(walk.startedAt);
      }
    } catch (err) {
      console.error("[dog-walk] Failed to start walk:", err);
    }
  }

  async function stopWalk() {
    const walk = activeWalk();
    if (!walk) return;
    // Optimistic update
    setActiveWalk(null);
    stopTicking();
    setElapsedSeconds(0);
    try {
      const stopped = await api.post<DogWalk>(`/dog-walks/${walk.id}/stop`, {});
      await fetchTodayStats();
      return stopped;
    } catch (err) {
      console.error("[dog-walk] Failed to stop walk:", err);
    }
  }

  async function fetchTodayStats() {
    const stats = await api.get<DogWalkStats>("/dog-walks/stats/today");
    setTodayStats(stats);
  }

  return {
    activeWalk,
    elapsedSeconds,
    todayStats,
    fetchActive,
    startWalk,
    stopWalk,
    fetchTodayStats,
  };
}
