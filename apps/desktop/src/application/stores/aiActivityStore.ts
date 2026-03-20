import { createSignal } from "solid-js";

export interface AiActivity {
  id: string;
  label: string;
  startedAt: number;
}

const [activities, setActivities] = createSignal<AiActivity[]>([]);

let nextId = 0;

function startActivity(label: string): string {
  const id = `ai-${++nextId}`;
  setActivities((prev) => [...prev, { id, label, startedAt: Date.now() }]);
  return id;
}

function endActivity(id: string) {
  setActivities((prev) => prev.filter((a) => a.id !== id));
}

/** Wrap an async operation with AI activity tracking */
export async function trackAiActivity<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const id = startActivity(label);
  try {
    return await fn();
  } finally {
    endActivity(id);
  }
}

export function useAiActivityStore() {
  return { activities };
}
