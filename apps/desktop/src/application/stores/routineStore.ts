import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import { notify } from "../../infrastructure/tauri/notifications";
import { useViewStore } from "./viewStore";
import type { ViewMode } from "../../domain/models/types";
import { createCrudStore } from "./createCrudStore";

export type RoutineStepAction = "navigate" | "sync" | "generate" | "notify";

export type RoutineStep =
  | { action: "navigate"; view: string }
  | { action: "sync"; target: "email" | "rss" | "github" }
  | { action: "generate"; target: "brief" | "changelog" | "rss-digest" }
  | { action: "notify"; title: string; body: string };

export interface Routine {
  id: string;
  name: string;
  triggerTime: string; // "HH:MM"
  triggerDays: number[]; // 0=Sun..6=Sat
  steps: RoutineStep[];
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoutineInput {
  name: string;
  triggerTime: string;
  triggerDays?: number[];
  steps?: RoutineStep[];
  enabled?: boolean;
}

export interface UpdateRoutineInput {
  name?: string;
  triggerTime?: string;
  triggerDays?: number[];
  steps?: RoutineStep[];
  enabled?: boolean;
}

const crud = createCrudStore<Routine, CreateRoutineInput, UpdateRoutineInput>({
  endpoint: "/routines",
  label: "routines",
});
const [firedToday, setFiredToday] = createSignal<Set<string>>(new Set());

let checkerInterval: ReturnType<typeof setInterval> | null = null;
let storedDate: string | null = null;

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCurrentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function executeStep(step: RoutineStep): Promise<void> {
  switch (step.action) {
    case "navigate": {
      const { setViewMode } = useViewStore();
      setViewMode(step.view as ViewMode);
      break;
    }
    case "sync": {
      const endpoints: Record<string, string> = {
        email: "/email-accounts/sync",
        rss: "/rss-feeds/sync",
        github: "/github/sync",
      };
      const endpoint = endpoints[step.target];
      if (endpoint) {
        await api.post(endpoint, {}).catch((e) => console.error(`Routine sync ${step.target} failed:`, e));
      }
      break;
    }
    case "generate": {
      const endpoints: Record<string, string> = {
        brief: "/brief/generate",
        changelog: "/changelog/generate",
        "rss-digest": "/rss-articles/digest",
      };
      const endpoint = endpoints[step.target];
      if (endpoint) {
        await api.post(endpoint, {}).catch((e) => console.error(`Routine generate ${step.target} failed:`, e));
      }
      break;
    }
    case "notify": {
      await notify(step.title, step.body);
      break;
    }
  }
}

async function executeRoutine(routine: Routine): Promise<void> {
  for (const step of routine.steps) {
    await executeStep(step);
  }
  // Notify server of the run
  await api.post(`/routines/${routine.id}/run`, {}).catch((e) => {
    console.error("Failed to mark routine run:", e);
  });
}

export function useRoutineStore() {
  function startRoutineChecker() {
    stopRoutineChecker();
    storedDate = getTodayDate();

    checkerInterval = setInterval(() => {
      const today = getTodayDate();

      // Detect day change: clear firedToday
      if (storedDate !== today) {
        storedDate = today;
        setFiredToday(new Set<string>());
      }

      const now = getCurrentTime();
      const dayOfWeek = new Date().getDay(); // 0=Sun..6=Sat
      const fired = firedToday();

      for (const routine of crud.items()) {
        if (!routine.enabled) continue;
        if (routine.triggerTime !== now) continue;
        if (!routine.triggerDays.includes(dayOfWeek)) continue;
        if (fired.has(routine.id)) continue;

        // Fire the routine
        executeRoutine(routine);

        // Add to firedToday
        setFiredToday((prev) => {
          const next = new Set(prev);
          next.add(routine.id);
          return next;
        });
      }
    }, 30_000);
  }

  function stopRoutineChecker() {
    if (checkerInterval !== null) {
      clearInterval(checkerInterval);
      checkerInterval = null;
    }
  }

  async function runRoutineNow(id: string) {
    const routine = crud.items().find((r) => r.id === id);
    if (routine) {
      await executeRoutine(routine);
    }
  }

  return {
    routines: crud.items,
    fetchRoutines: crud.fetchAll,
    createRoutine: crud.create,
    updateRoutine: crud.update,
    deleteRoutine: crud.delete,
    startRoutineChecker,
    stopRoutineChecker,
    runRoutineNow,
  };
}
