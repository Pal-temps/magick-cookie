import { useOfflineQueue } from "../offline/offlineQueue";
import { API_BASE, authHeaders } from "../config";

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
        ...authHeaders(),
        ...options?.headers,
      },
    });

    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      throw new Error((json.error as string) || `HTTP ${res.status}`);
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

/** Like request(), but returns the full JSON envelope (e.g. { data, total }) instead of just data. */
async function requestRaw<T>(path: string, options?: RequestInit): Promise<T> {
  const { enqueue, setIsOnline } = useOfflineQueue();
  const method = options?.method ?? "GET";
  const fullUrl = `${API_BASE}${path}`;

  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...options?.headers,
      },
    });

    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      throw new Error((json.error as string) || `HTTP ${res.status}`);
    }

    return json as T;
  } catch (err) {
    if (isNetworkError(err)) {
      setIsOnline(false);
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
  /** Returns the full JSON envelope (e.g. { data: T[], total: number }) — use for paginated endpoints. */
  getRaw: <T>(path: string) => requestRaw<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
