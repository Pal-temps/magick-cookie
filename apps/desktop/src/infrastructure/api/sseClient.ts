import { api } from "./apiClient";
import { SSE_BASE } from "../config";

export interface SSEReminderPayload {
  id: string;
  eventId: string;
  type: "push";
  minutesBefore: number;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
  eventTitle: string;
  eventStartAt: string;
}

const SSE_URL = SSE_BASE;

export function connectSSE(onReminder: (reminder: SSEReminderPayload) => void): () => void {
  let source: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    source = new EventSource(SSE_URL);

    source.addEventListener("reminder", async (e) => {
      const reminder: SSEReminderPayload = JSON.parse(e.data);
      onReminder(reminder);
      // Acknowledge — tell the API we displayed the notification
      try {
        await api.post(`/reminders/${reminder.id}/ack`, {});
      } catch {
        // Will be retried on next emission
      }
    });

    source.addEventListener("heartbeat", () => {
      // Connection alive
    });

    source.onerror = () => {
      source?.close();
      source = null;
      // Reconnect after 5s
      reconnectTimer = setTimeout(connect, 5_000);
    };
  }

  connect();

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    source?.close();
    source = null;
  };
}
