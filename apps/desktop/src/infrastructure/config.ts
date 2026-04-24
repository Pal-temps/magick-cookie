// Single source of truth for where the desktop app talks to the backend API.
// Override at build time with VITE_API_BASE (e.g. when shipping a remote-API build). The default
// keeps local Tauri/dev pointed at the bundled API process.
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:47300/api";

export const SSE_BASE: string = `${API_BASE}/sse`;

// Bearer token forwarded on every /api/* request. Leave the env var unset for local usage where
// the API runs with an empty API_AUTH_TOKEN. Set VITE_API_AUTH_TOKEN when pointing the desktop
// app at a deployed/auth-enabled API.
export const API_AUTH_TOKEN: string = (import.meta.env.VITE_API_AUTH_TOKEN as string | undefined) ?? "";

export function authHeaders(): Record<string, string> {
  return API_AUTH_TOKEN ? { Authorization: `Bearer ${API_AUTH_TOKEN}` } : {};
}
