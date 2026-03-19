import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import type { WellnessConfig, CreateWellnessConfigDTO, UpdateWellnessConfigDTO } from "../../domain/models/WellnessConfig";
import type { WellnessLog } from "../../domain/models/WellnessLog";
import { notify } from "../../infrastructure/tauri/notifications";
import type { SoundName } from "../../infrastructure/audio/soundPlayer";

const [configs, setConfigs] = createSignal<WellnessConfig[]>([]);
const [todayLogs, setTodayLogs] = createSignal<WellnessLog[]>([]);
const activeIntervals = new Map<string, ReturnType<typeof setInterval>>();

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function sendWellnessNotification(config: WellnessConfig) {
  await notify("Bien-etre", config.label, {
    sound: (config.alertSound as SoundName) || undefined,
  });
}

export function useWellnessStore() {
  async function fetchConfigs() {
    try {
      const data = await api.get<WellnessConfig[]>("/wellness-configs");
      setConfigs(data);
    } catch (e) {
      console.error("Failed to fetch wellness configs:", e);
    }
  }

  async function createConfig(input: CreateWellnessConfigDTO) {
    try {
      const config = await api.post<WellnessConfig>("/wellness-configs", input);
      if (config) {
        setConfigs((prev) => [...prev, config]);
        if (config.enabled) {
          startInterval(config);
        }
      }
      return config;
    } catch (err) {
      console.error("[wellness] Failed to create config:", err);
      throw err;
    }
  }

  async function updateConfig(id: string, input: UpdateWellnessConfigDTO) {
    try {
      const config = await api.put<WellnessConfig>(`/wellness-configs/${id}`, input);
      if (config) {
        setConfigs((prev) => prev.map((c) => (c.id === id ? config : c)));
        stopInterval(id);
        if (config.enabled) {
          startInterval(config);
        }
      }
      return config;
    } catch (err) {
      console.error("[wellness] Failed to update config:", err);
      throw err;
    }
  }

  async function deleteConfig(id: string) {
    // Optimistic update
    stopInterval(id);
    setConfigs((prev) => prev.filter((c) => c.id !== id));
    try {
      await api.delete(`/wellness-configs/${id}`);
    } catch (err) {
      console.error("[wellness] Failed to delete config:", err);
    }
  }

  function startInterval(config: WellnessConfig) {
    stopInterval(config.id);
    const ms = config.intervalMinutes * 60_000;
    const id = setInterval(() => sendWellnessNotification(config), ms);
    activeIntervals.set(config.id, id);
  }

  function stopInterval(configId: string) {
    const id = activeIntervals.get(configId);
    if (id !== undefined) {
      clearInterval(id);
      activeIntervals.delete(configId);
    }
  }

  function startAll() {
    stopAll();
    for (const config of configs()) {
      if (config.enabled) {
        startInterval(config);
      }
    }
  }

  function stopAll() {
    for (const [, id] of activeIntervals) {
      clearInterval(id);
    }
    activeIntervals.clear();
  }

  function snooze(configId: string, minutes: number) {
    stopInterval(configId);
    const config = configs().find((c) => c.id === configId);
    if (!config) return;

    setTimeout(() => {
      startInterval(config);
      sendWellnessNotification(config);
    }, minutes * 60_000);
  }

  async function fetchTodayLogs() {
    try {
      const date = getTodayDate();
      const data = await api.get<WellnessLog[]>(`/wellness-logs?date=${date}`);
      setTodayLogs(data);
    } catch (e) {
      console.error("Failed to fetch wellness logs:", e);
    }
  }

  async function incrementLog(type: string, amount: number) {
    try {
      const date = getTodayDate();
      const log = await api.post<WellnessLog>("/wellness-logs/increment", { type, date, amount });
      setTodayLogs((prev) => {
        const idx = prev.findIndex((l) => l.type === type && l.date === date);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = log;
          return updated;
        }
        return [...prev, log];
      });
      return log;
    } catch (e) {
      console.error("Failed to increment wellness log:", e);
    }
  }

  async function setGoal(type: string, goal: number) {
    try {
      const date = getTodayDate();
      const log = await api.post<WellnessLog>("/wellness-logs/goal", { type, date, goal });
      setTodayLogs((prev) => {
        const idx = prev.findIndex((l) => l.type === type && l.date === date);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = log;
          return updated;
        }
        return [...prev, log];
      });
      return log;
    } catch (e) {
      console.error("Failed to set wellness goal:", e);
    }
  }

  function getLog(type: string): WellnessLog | undefined {
    const date = getTodayDate();
    return todayLogs().find((l) => l.type === type && l.date === date);
  }

  return {
    configs,
    todayLogs,
    fetchConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    startAll,
    stopAll,
    snooze,
    fetchTodayLogs,
    incrementLog,
    setGoal,
    getLog,
  };
}
