// Safe wrappers around the Web Storage API. Browsers can throw on quota exceeded, on privacy
// mode, or when the user has disabled storage — we don't want any of those paths to crash the app.
// Callers that need schema validation can pass a `validate` guard.

export function safeGetString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetString(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// Parses a JSON value from localStorage. Returns `fallback` when the key is missing, the payload
// is not valid JSON, or `validate` (if provided) rejects the shape. Callers should treat the
// return as authoritative — never re-read the raw value after this.
export function safeGetJSON<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T,
): T {
  const raw = safeGetString(key);
  if (raw == null) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (validate && !validate(parsed)) return fallback;
  return parsed as T;
}

export function safeSetJSON(key: string, value: unknown): boolean {
  try {
    return safeSetString(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
