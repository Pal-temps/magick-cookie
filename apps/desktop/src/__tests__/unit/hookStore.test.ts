import { describe, it, expect } from "bun:test";

// ─── Pure logic extracted from hookStore.ts (no Tauri/SolidJS deps) ───

interface HookResult {
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  success: boolean;
}

const MAX_RETRIES = 3;

// Retry counter logic (extracted from hookStore)
function createRetryTracker() {
  const map = new Map<string, number>();
  return {
    increment(sessionId: string): number {
      const count = (map.get(sessionId) ?? 0) + 1;
      map.set(sessionId, count);
      return count;
    },
    reset(sessionId: string) {
      map.set(sessionId, 0);
    },
    get(sessionId: string): number {
      return map.get(sessionId) ?? 0;
    },
  };
}

// Filter file references (from runHooks)
function filterCommands(hooks: string[]): string[] {
  return hooks.filter((cmd) => !cmd.startsWith("file:"));
}

// Build failure message (from onTurnComplete)
function buildFailureMessage(results: HookResult[], retryCount: number): string | null {
  const allPassed = results.every((r) => r.success);
  if (allPassed) return null;

  const failures = results
    .filter((r) => !r.success)
    .map((r) => {
      const output = [r.stdout, r.stderr].filter(Boolean).join("\n").trim();
      const truncated = output.length > 2000 ? output.slice(-2000) : output;
      return `**\`${r.command}\`** (exit ${r.exit_code}):\n\`\`\`\n${truncated}\n\`\`\``;
    })
    .join("\n\n");

  return `[Auto-validation failed — attempt ${retryCount}/${MAX_RETRIES}]\n\n${failures}\n\nPlease fix the issues above.`;
}

// ─── Tests ───

describe("Retry Tracker", () => {
  it("starts at 0", () => {
    const tracker = createRetryTracker();
    expect(tracker.get("s1")).toBe(0);
  });

  it("increments correctly", () => {
    const tracker = createRetryTracker();
    expect(tracker.increment("s1")).toBe(1);
    expect(tracker.increment("s1")).toBe(2);
    expect(tracker.increment("s1")).toBe(3);
  });

  it("tracks sessions independently", () => {
    const tracker = createRetryTracker();
    tracker.increment("s1");
    tracker.increment("s1");
    tracker.increment("s2");
    expect(tracker.get("s1")).toBe(2);
    expect(tracker.get("s2")).toBe(1);
  });

  it("resets correctly", () => {
    const tracker = createRetryTracker();
    tracker.increment("s1");
    tracker.increment("s1");
    tracker.reset("s1");
    expect(tracker.get("s1")).toBe(0);
    expect(tracker.increment("s1")).toBe(1);
  });

  it("respects MAX_RETRIES limit", () => {
    const tracker = createRetryTracker();
    for (let i = 0; i < MAX_RETRIES; i++) {
      tracker.increment("s1");
    }
    const next = tracker.increment("s1");
    expect(next).toBeGreaterThan(MAX_RETRIES);
  });
});

describe("filterCommands", () => {
  it("keeps shell commands", () => {
    const result = filterCommands(["bun test", "tsc --noEmit"]);
    expect(result).toEqual(["bun test", "tsc --noEmit"]);
  });

  it("filters file references", () => {
    const result = filterCommands(["bun test", "file:snippet::abc", "file:notes::todo.md", "tsc"]);
    expect(result).toEqual(["bun test", "tsc"]);
  });

  it("returns empty for only file refs", () => {
    const result = filterCommands(["file:a", "file:b"]);
    expect(result).toEqual([]);
  });

  it("handles empty array", () => {
    const result = filterCommands([]);
    expect(result).toEqual([]);
  });
});

describe("buildFailureMessage", () => {
  const makeResult = (overrides: Partial<HookResult> = {}): HookResult => ({
    command: "bun test",
    exit_code: 1,
    stdout: "1 fail",
    stderr: "",
    duration_ms: 500,
    success: false,
    ...overrides,
  });

  it("returns null when all pass", () => {
    const results = [makeResult({ success: true, exit_code: 0 })];
    expect(buildFailureMessage(results, 1)).toBeNull();
  });

  it("includes attempt counter", () => {
    const results = [makeResult()];
    const msg = buildFailureMessage(results, 2)!;
    expect(msg).toContain("attempt 2/3");
  });

  it("includes command name and exit code", () => {
    const results = [makeResult({ command: "tsc --noEmit", exit_code: 2 })];
    const msg = buildFailureMessage(results, 1)!;
    expect(msg).toContain("`tsc --noEmit`");
    expect(msg).toContain("exit 2");
  });

  it("includes stdout and stderr", () => {
    const results = [makeResult({ stdout: "FAIL: test.ts", stderr: "error TS2345" })];
    const msg = buildFailureMessage(results, 1)!;
    expect(msg).toContain("FAIL: test.ts");
    expect(msg).toContain("error TS2345");
  });

  it("truncates long output to 2000 chars", () => {
    const longOutput = "x".repeat(3000);
    const results = [makeResult({ stdout: longOutput })];
    const msg = buildFailureMessage(results, 1)!;
    // The truncated output should be the last 2000 chars
    expect(msg).not.toContain("x".repeat(3000));
    expect(msg.length).toBeLessThan(3000 + 200); // message + formatting overhead
  });

  it("only includes failed results", () => {
    const results = [
      makeResult({ command: "bun test", success: true, exit_code: 0 }),
      makeResult({ command: "tsc", success: false, exit_code: 1 }),
    ];
    const msg = buildFailureMessage(results, 1)!;
    expect(msg).not.toContain("`bun test`");
    expect(msg).toContain("`tsc`");
  });

  it("joins multiple failures", () => {
    const results = [
      makeResult({ command: "bun test", stdout: "fail1" }),
      makeResult({ command: "tsc", stdout: "fail2" }),
    ];
    const msg = buildFailureMessage(results, 1)!;
    expect(msg).toContain("`bun test`");
    expect(msg).toContain("`tsc`");
    expect(msg).toContain("fail1");
    expect(msg).toContain("fail2");
  });
});
