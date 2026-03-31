import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import { playSound } from "../../infrastructure/audio/soundPlayer";
import { notify } from "../../infrastructure/tauri/notifications";

export interface Alarm {
  id: string;
  time: string; // "HH:MM"
  label: string;
  repeatPattern: "once" | "daily" | "weekdays" | "weekends" | "custom";
  repeatDays: number[] | null; // 0=Sun..6=Sat
  enabled: boolean;
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
}

export interface UpdateAlarmInput {
  time?: string;
  label?: string;
  repeatPattern?: "once" | "daily" | "weekdays" | "weekends" | "custom";
  repeatDays?: number[] | null;
  enabled?: boolean;
}

const [alarms, setAlarms] = createSignal<Alarm[]>([]);
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
  async function fetchAlarms() {
    try {
      const data = await api.get<Alarm[]>("/alarms");
      setAlarms(data);
    } catch (e) {
      console.error("Failed to fetch alarms:", e);
    }
  }

  async function createAlarm(input: CreateAlarmInput) {
    try {
      const alarm = await api.post<Alarm>("/alarms", input);
      setAlarms((prev) => [...prev, alarm]);
      return alarm;
    } catch (e) {
      console.error("Failed to create alarm:", e);
    }
  }

  async function updateAlarm(id: string, input: UpdateAlarmInput) {
    try {
      const alarm = await api.put<Alarm>(`/alarms/${id}`, input);
      setAlarms((prev) => prev.map((a) => (a.id === id ? alarm : a)));
      return alarm;
    } catch (e) {
      console.error("Failed to update alarm:", e);
    }
  }

  async function deleteAlarm(id: string) {
    try {
      await api.delete(`/alarms/${id}`);
      setAlarms((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error("Failed to delete alarm:", e);
    }
  }

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

      for (const alarm of alarms()) {
        if (!alarm.enabled) continue;
        if (alarm.time !== now) continue;
        if (!shouldFireOnDay(alarm, dayOfWeek)) continue;
        if (fired.has(alarm.id)) continue;

        // Fire the alarm
        playSound("alarm");
        notify("Alarme \u2014 " + alarm.label, alarm.time, { silent: true });

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
    alarms,
    firedToday,
    fetchAlarms,
    createAlarm,
    updateAlarm,
    deleteAlarm,
    startAlarmChecker,
    stopAlarmChecker,
  };
}
