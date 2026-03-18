import { createSignal } from "solid-js";

export interface EnvCheck {
  name: string;
  url: string;
  status: "up" | "down" | "checking";
}

const STORAGE_KEY = "env-custom-checks";

function loadCustomChecks(): EnvCheck[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { name: string; url: string }[];
      return parsed.map((c) => ({ name: c.name, url: c.url, status: "checking" as const }));
    }
  } catch { /* ignore */ }
  return [];
}

function saveCustomChecks(checks: EnvCheck[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(checks.map((c) => ({ name: c.name, url: c.url }))),
  );
}

const DEFAULT_CHECKS: EnvCheck[] = [
  { name: "API", url: "http://localhost:47300/api/health", status: "checking" },
  { name: "PostgreSQL", url: "http://localhost:47300/api/health", status: "checking" },
];

const [checks, setChecks] = createSignal<EnvCheck[]>([
  ...DEFAULT_CHECKS,
  ...loadCustomChecks(),
]);

async function checkUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, mode: "no-cors" });
    clearTimeout(timeout);
    // mode: no-cors returns opaque response with status 0, which is still "up"
    return res.ok || res.status === 0;
  } catch {
    return false;
  }
}

async function runChecks() {
  // Set all to "checking"
  setChecks((prev) =>
    prev.map((c) => ({ ...c, status: "checking" as const })),
  );

  const current = checks();
  const results = await Promise.all(
    current.map(async (c) => {
      const isUp = await checkUrl(c.url);
      return { ...c, status: (isUp ? "up" : "down") as "up" | "down" };
    }),
  );
  setChecks(results);
}

function addCheck(name: string, url: string) {
  const newCheck: EnvCheck = { name, url, status: "checking" };
  setChecks((prev) => {
    const updated = [...prev, newCheck];
    // Save only custom checks (skip default count)
    saveCustomChecks(updated.slice(DEFAULT_CHECKS.length));
    return updated;
  });
}

function removeCheck(index: number) {
  if (index < DEFAULT_CHECKS.length) return; // Cannot remove defaults
  setChecks((prev) => {
    const updated = prev.filter((_, i) => i !== index);
    saveCustomChecks(updated.slice(DEFAULT_CHECKS.length));
    return updated;
  });
}

export function useEnvStore() {
  return {
    checks,
    runChecks,
    addCheck,
    removeCheck,
  };
}
