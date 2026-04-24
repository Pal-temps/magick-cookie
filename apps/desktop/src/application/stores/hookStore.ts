import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useAiSessionStore } from "./aiSessionStore";

export interface HookResult {
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  success: boolean;
}

export interface TurnHookResults {
  turnSeq: number;
  results: HookResult[];
  allPassed: boolean;
  timestamp: number;
}

// ─── State ───

const STORAGE_KEY = "hook-auto-validation";

const [autoValidationEnabled, setAutoValidationEnabledRaw] = createSignal(
  localStorage.getItem(STORAGE_KEY) === "1"
);
const [hookResultsBySession, setHookResultsBySession] = createSignal<Map<string, TurnHookResults[]>>(new Map());
const [isRunningHooks, setIsRunningHooks] = createSignal(false);

// Track retries per session to prevent infinite loops
const retryCountMap = new Map<string, number>();
const MAX_RETRIES = 3;

function setAutoValidationEnabled(val: boolean) {
  setAutoValidationEnabledRaw(val);
  localStorage.setItem(STORAGE_KEY, val ? "1" : "0");
}

// ─── Actions ───

async function runHooks(cwd: string, hooks: string[]): Promise<HookResult[]> {
  const results: HookResult[] = [];
  for (const command of hooks) {
    // Skip file references — only run shell commands
    if (command.startsWith("file:")) continue;
    try {
      const result = await invoke<HookResult>("ai_run_hook", { cwd, command });
      results.push(result);
    } catch (e) {
      results.push({
        command,
        exit_code: -1,
        stdout: "",
        stderr: String(e),
        duration_ms: 0,
        success: false,
      });
    }
  }
  return results;
}

function addResults(sessionId: string, turnResults: TurnHookResults) {
  setHookResultsBySession((prev) => {
    const next = new Map(prev);
    const existing = next.get(sessionId) ?? [];
    next.set(sessionId, [...existing, turnResults]);
    return next;
  });
}

function getResultsForSession(sessionId: string): TurnHookResults[] {
  return hookResultsBySession().get(sessionId) ?? [];
}

function resetRetries(sessionId: string) {
  retryCountMap.set(sessionId, 0);
}

function cleanupSession(sessionId: string) {
  retryCountMap.delete(sessionId);
  setHookResultsBySession((prev) => {
    const next = new Map(prev);
    next.delete(sessionId);
    return next;
  });
}

function incrementRetries(sessionId: string): number {
  const count = (retryCountMap.get(sessionId) ?? 0) + 1;
  retryCountMap.set(sessionId, count);
  return count;
}

/**
 * Called when a turn completes. Runs preCommit hooks and returns
 * a failure message to inject into the next AI message, or null if all passed.
 */
async function onTurnComplete(
  sessionId: string,
  cwd: string,
  preCommitHooks: string[],
): Promise<string | null> {
  if (!autoValidationEnabled()) return null;
  if (preCommitHooks.length === 0) return null;

  // Check retry limit
  const retries = incrementRetries(sessionId);
  if (retries > MAX_RETRIES) {
    resetRetries(sessionId);
    return null; // Stop auto-fix loop
  }

  setIsRunningHooks(true);

  try {
    const results = await runHooks(cwd, preCommitHooks);
    if (results.length === 0) return null;

    const allPassed = results.every((r) => r.success);

    addResults(sessionId, {
      turnSeq: retries,
      results,
      allPassed,
      timestamp: Date.now(),
    });

    if (allPassed) {
      resetRetries(sessionId);
      return null;
    }

    // Build failure message for AI
    const failures = results
      .filter((r) => !r.success)
      .map((r) => {
        const output = [r.stdout, r.stderr].filter(Boolean).join("\n").trim();
        const truncated = output.length > 2000 ? output.slice(-2000) : output;
        return `**\`${r.command}\`** (exit ${r.exit_code}):\n\`\`\`\n${truncated}\n\`\`\``;
      })
      .join("\n\n");

    return `[Auto-validation failed — attempt ${retries}/${MAX_RETRIES}]\n\n${failures}\n\nPlease fix the issues above.`;
  } finally {
    setIsRunningHooks(false);
  }
}

// ─── Register cleanup with AI session store ───

let cleanupRegistered = false;

// ─── Export ───

export function useHookStore() {
  if (!cleanupRegistered) {
    cleanupRegistered = true;
    const ai = useAiSessionStore();
    ai.onSessionCleanup(cleanupSession);
  }

  return {
    autoValidationEnabled,
    setAutoValidationEnabled,
    isRunningHooks,
    hookResultsBySession,
    getResultsForSession,
    onTurnComplete,
    resetRetries,
    cleanupSession,
  };
}
