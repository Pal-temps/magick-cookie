import { useOfflineQueue } from "../offline/offlineQueue";

const API_BASE = "http://localhost:47300/api";

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("network") || err.message.includes("Failed"))) {
    return true;
  }
  return false;
}

const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { enqueue, setIsOnline } = useOfflineQueue();
  const method = options?.method ?? "GET";
  const fullUrl = `${API_BASE}${path}`;

  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    return json.data as T;
  } catch (err) {
    if (isNetworkError(err)) {
      setIsOnline(false);

      // Queue write operations for later replay — return silently so callers don't crash
      if (WRITE_METHODS.includes(method)) {
        const body = options?.body ? JSON.parse(options.body as string) : undefined;
        enqueue(method, fullUrl, body);
        return undefined as T;
      }
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
