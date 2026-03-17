import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import { notify } from "../../infrastructure/tauri/notifications";

export interface SmartAlert {
  type: string;
  message: string;
  count: number;
}

const [alerts, setAlerts] = createSignal<SmartAlert[]>([]);

let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let lastNotifiedHash = "";
let lastResetTime = Date.now();

const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function computeHash(alerts: SmartAlert[]): string {
  return alerts.map((a) => `${a.type}:${a.count}`).sort().join("|");
}

export function useSmartReminderStore() {
  async function checkAlerts() {
    try {
      const data = await api.get<{ alerts: SmartAlert[] }>("/smart-reminders");
      setAlerts(data.alerts);

      // Reset hash every 24h
      if (Date.now() - lastResetTime > RESET_INTERVAL_MS) {
        lastNotifiedHash = "";
        lastResetTime = Date.now();
      }

      // Only notify if hash changed
      const hash = computeHash(data.alerts);
      if (hash && hash !== lastNotifiedHash) {
        lastNotifiedHash = hash;
        for (const alert of data.alerts) {
          await notify("Rappel intelligent", alert.message);
        }
      }
    } catch (e) {
      console.error("Failed to check smart reminders:", e);
    }
  }

  function startSmartReminders() {
    // Initial check after a short delay
    setTimeout(checkAlerts, 10_000);
    pollIntervalId = setInterval(checkAlerts, POLL_INTERVAL_MS);
  }

  function stopSmartReminders() {
    if (pollIntervalId !== null) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  return {
    alerts,
    checkAlerts,
    startSmartReminders,
    stopSmartReminders,
  };
}
