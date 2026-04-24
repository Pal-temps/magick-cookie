import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import { playSound, type SoundName } from "../../infrastructure/audio/soundPlayer";
import { notify } from "../../infrastructure/tauri/notifications";
import { createCrudStore } from "./createCrudStore";

export interface Alarm {
  id: string;
  time: string; // "HH:MM"
  label: string;
  repeatPattern: "once" | "daily" | "weekdays" | "weekends" | "custom";
  repeatDays: number[] | null; // 0=Sun..6=Sat
  enabled: boolean;
  alertSound: string | null;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlarmInput {
  time: string;
  label: string;
  repeatPattern: "once" | "daily" | "weekdays" | "weekends" | "custom";
  repeatDays?: number[] | null;
  enabled?: boolean;
  alertSound?: string | null;
}

export interface UpdateAlarmInput {
  time?: string;
  label?: string;
  repeatPattern?: "once" | "daily" | "weekdays" | "weekends" | "custom";
  repeatDays?: number[] | null;
  enabled?: boolean;
  alertSound?: string | null;
}

const crud = createCrudStore<Alarm, CreateAlarmInput, UpdateAlarmInput>({
  endpoint: "/alarms",
  label: "alarms",
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

function shouldFireOnDay(alarm: Alarm, day: number): boolean {
  switch (alarm.repeatPattern) {
    case "daily":
      return true;
    case "weekdays":
      return day >= 1 && day <= 5;
    case "weekends":
      return day === 0 || day === 6;
    case "custom":
      return alarm.repeatDays?.includes(day) ?? false;
    case "once":
      return true;
    default:
      return false;
  }
}

export function useAlarmStore() {
  function startAlarmChecker() {
    stopAlarmChecker();
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

      for (const alarm of crud.items()) {
        if (!alarm.enabled) continue;
        if (alarm.time !== now) continue;
        if (!shouldFireOnDay(alarm, dayOfWeek)) continue;
        if (fired.has(alarm.id)) continue;

        // Fire the alarm
        playSound((alarm.alertSound ?? "alarm") as SoundName);
        notify("Alarme — " + alarm.label, alarm.time, { silent: true });

        // Add to firedToday
        setFiredToday((prev) => {
          const next = new Set(prev);
          next.add(alarm.id);
          return next;
        });

        // Notify server
        api.post(`/alarms/${alarm.id}/fire`, {}).catch((e) => {
          console.error("Failed to fire alarm:", e);
        });
      }
    }, 30_000);
  }

  function stopAlarmChecker() {
    if (checkerInterval !== null) {
      clearInterval(checkerInterval);
      checkerInterval = null;
    }
  }

  return {
    alarms: crud.items,
    firedToday,
    fetchAlarms: crud.fetchAll,
    createAlarm: crud.create,
    updateAlarm: crud.update,
    deleteAlarm: crud.delete,
    startAlarmChecker,
    stopAlarmChecker,
  };
}
