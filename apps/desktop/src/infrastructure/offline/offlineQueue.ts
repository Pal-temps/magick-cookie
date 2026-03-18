import { createSignal } from "solid-js";

export interface QueuedRequest {
  id: string;
  method: string;
  url: string;
  body?: any;
  timestamp: number;
}

const QUEUE_KEY = "magick-cookie-offline-queue";

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
    const updated = [...queue(), request];
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
            headers: { "Content-Type": "application/json" },
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
      const res = await fetch("http://localhost:47300/api/health", {
        method: "GET",
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
