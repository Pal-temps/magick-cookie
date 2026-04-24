import { createSignal } from "solid-js";
import { API_BASE, authHeaders } from "../config";

export interface QueuedRequest {
  id: string;
  method: string;
  url: string;
  body?: any;
  timestamp: number;
}

const QUEUE_KEY = "magick-cookie-offline-queue";
const MAX_QUEUE_SIZE = 5000;

function loadQueue(): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedRequest[];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedRequest[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

const [queue, setQueue] = createSignal<QueuedRequest[]>(loadQueue());
const [isOnline, setIsOnline] = createSignal(true);
const [isSyncing, setIsSyncing] = createSignal(false);

let connectivityInterval: ReturnType<typeof setInterval> | null = null;

export function useOfflineQueue() {
  function enqueue(method: string, url: string, body?: any) {
    const request: QueuedRequest = {
      id: crypto.randomUUID(),
      method,
      url,
      body,
      timestamp: Date.now(),
    };
    let updated = [...queue(), request];
    // Drop oldest entries if queue exceeds max size
    if (updated.length > MAX_QUEUE_SIZE) {
      updated = updated.slice(updated.length - MAX_QUEUE_SIZE);
    }
    setQueue(updated);
    saveQueue(updated);
  }

  function removeFromQueue(id: string) {
    const updated = queue().filter((r) => r.id !== id);
    setQueue(updated);
    saveQueue(updated);
  }

  function clearQueue() {
    setQueue([]);
    localStorage.removeItem(QUEUE_KEY);
  }

  async function replayQueue(): Promise<void> {
    const pending = queue();
    if (pending.length === 0) return;

    setIsSyncing(true);
    try {
      for (const request of pending) {
        try {
          const res = await fetch(request.url, {
            method: request.method,
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: request.body ? JSON.stringify(request.body) : undefined,
          });
          if (res.ok) {
            removeFromQueue(request.id);
          } else {
            // Server error — stop replaying to preserve order
            break;
          }
        } catch {
          // Still offline — stop replaying
          break;
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }

  async function checkConnectivity(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, {
        method: "GET",
        headers: authHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      const online = res.ok;
      const wasOffline = !isOnline();
      setIsOnline(online);
      if (online && wasOffline) {
        await replayQueue();
      }
      return online;
    } catch {
      setIsOnline(false);
      return false;
    }
  }

  function startConnectivityCheck() {
    if (connectivityInterval) return;
    connectivityInterval = setInterval(() => {
      checkConnectivity();
    }, 10_000);
  }

  function stopConnectivityCheck() {
    if (connectivityInterval) {
      clearInterval(connectivityInterval);
      connectivityInterval = null;
    }
  }

  return {
    queue,
    isOnline,
    isSyncing,
    enqueue,
    clearQueue,
    replayQueue,
    checkConnectivity,
    startConnectivityCheck,
    stopConnectivityCheck,
    setIsOnline,
  };
}
