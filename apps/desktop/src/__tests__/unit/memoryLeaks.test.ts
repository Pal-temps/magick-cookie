import { describe, it, expect } from "bun:test";

/**
 * Memory leak prevention tests.
 *
 * These tests verify that stores with Maps/Sets/arrays that grow over time
 * have proper cleanup mechanisms, and that bounded buffers respect their limits.
 *
 * We extract and test the pure logic — no Tauri/SolidJS runtime needed.
 */

// ─── hookStore: cleanup session data ───

describe("hookStore — session cleanup", () => {
  // Simulates hookResultsBySession Map behavior
  function createHookResultsTracker() {
    const map = new Map<string, { turnSeq: number; allPassed: boolean }[]>();
    const retryMap = new Map<string, number>();

    return {
      addResult(sessionId: string, result: { turnSeq: number; allPassed: boolean }) {
        const existing = map.get(sessionId) ?? [];
        map.set(sessionId, [...existing, result]);
      },
      incrementRetries(sessionId: string): number {
        const count = (retryMap.get(sessionId) ?? 0) + 1;
        retryMap.set(sessionId, count);
        return count;
      },
      cleanup(sessionId: string) {
        map.delete(sessionId);
        retryMap.delete(sessionId);
      },
      resultsSize: () => map.size,
      retrySize: () => retryMap.size,
      getResults: (id: string) => map.get(id),
    };
  }

  it("accumulates results per session", () => {
    const tracker = createHookResultsTracker();
    tracker.addResult("s1", { turnSeq: 1, allPassed: true });
    tracker.addResult("s1", { turnSeq: 2, allPassed: false });
    expect(tracker.getResults("s1")).toHaveLength(2);
  });

  it("cleanup removes session data completely", () => {
    const tracker = createHookResultsTracker();
    tracker.addResult("s1", { turnSeq: 1, allPassed: true });
    tracker.addResult("s2", { turnSeq: 1, allPassed: true });
    tracker.incrementRetries("s1");
    tracker.incrementRetries("s2");

    tracker.cleanup("s1");

    expect(tracker.resultsSize()).toBe(1);
    expect(tracker.retrySize()).toBe(1);
    expect(tracker.getResults("s1")).toBeUndefined();
    expect(tracker.getResults("s2")).toHaveLength(1);
  });

  it("does not leak when many sessions are created and cleaned up", () => {
    const tracker = createHookResultsTracker();

    // Simulate 100 sessions being created and destroyed
    for (let i = 0; i < 100; i++) {
      const id = `session-${i}`;
      tracker.addResult(id, { turnSeq: 1, allPassed: true });
      tracker.addResult(id, { turnSeq: 2, allPassed: false });
      tracker.incrementRetries(id);
      tracker.incrementRetries(id);
      tracker.cleanup(id);
    }

    expect(tracker.resultsSize()).toBe(0);
    expect(tracker.retrySize()).toBe(0);
  });
});

// ─── aiSessionStore: session cleanup callbacks ───

describe("aiSessionStore — cleanup callback pattern", () => {
  function createSessionManager() {
    const sessions = new Map<string, { id: string }>();
    const cleanupCallbacks: ((id: string) => void)[] = [];

    return {
      addSession(id: string) {
        sessions.set(id, { id });
      },
      stopSession(id: string) {
        sessions.delete(id);
        for (const cb of cleanupCallbacks) cb(id);
      },
      onCleanup(cb: (id: string) => void) {
        cleanupCallbacks.push(cb);
      },
      sessionCount: () => sessions.size,
    };
  }

  it("notifies cleanup callbacks when session stops", () => {
    const mgr = createSessionManager();
    const cleaned: string[] = [];
    mgr.onCleanup((id) => cleaned.push(id));

    mgr.addSession("s1");
    mgr.addSession("s2");
    mgr.stopSession("s1");

    expect(cleaned).toEqual(["s1"]);
    expect(mgr.sessionCount()).toBe(1);
  });

  it("notifies multiple callbacks", () => {
    const mgr = createSessionManager();
    let hookCleaned = false;
    let otherCleaned = false;

    mgr.onCleanup(() => { hookCleaned = true; });
    mgr.onCleanup(() => { otherCleaned = true; });

    mgr.addSession("s1");
    mgr.stopSession("s1");

    expect(hookCleaned).toBe(true);
    expect(otherCleaned).toBe(true);
  });
});

// ─── clipboardStore: init guard ───

describe("clipboardStore — single init guard", () => {
  it("prevents multiple listener registrations", () => {
    let initCount = 0;
    let initialized = false;

    function init() {
      if (initialized) return;
      initialized = true;
      initCount++;
    }

    init();
    init();
    init();

    expect(initCount).toBe(1);
  });
});

// ─── Bounded buffer (event_buffer pattern) ───

describe("Bounded collections — prevent unbounded growth", () => {
  function createBoundedBuffer<T>(maxSize: number) {
    const buffer: T[] = [];
    return {
      push(item: T) {
        if (buffer.length >= maxSize) buffer.shift();
        buffer.push(item);
      },
      size: () => buffer.length,
      items: () => [...buffer],
    };
  }

  it("never exceeds max size", () => {
    const buf = createBoundedBuffer<string>(5);
    for (let i = 0; i < 100; i++) {
      buf.push(`item-${i}`);
    }
    expect(buf.size()).toBe(5);
    expect(buf.items()[0]).toBe("item-95"); // oldest surviving
  });

  it("works correctly under capacity", () => {
    const buf = createBoundedBuffer<number>(10);
    buf.push(1);
    buf.push(2);
    expect(buf.size()).toBe(2);
  });
});

// ─── Timer cleanup pattern ───

describe("Timer cleanup patterns", () => {
  it("clearTimeout on stored reference prevents leak", () => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let executed = false;

    // Start
    timeoutId = setTimeout(() => { executed = true; }, 100_000);

    // Stop before execution
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    expect(timeoutId).toBeNull();
    expect(executed).toBe(false);
  });

  it("setInterval can be properly cleared", () => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let count = 0;

    intervalId = setInterval(() => { count++; }, 1);

    // Immediate cleanup
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }

    expect(intervalId).toBeNull();
  });
});

// ─── Dedup window (dedup.rs pattern) ───

describe("Dedup window — bounded memory", () => {
  const WINDOW_SIZE = 50;

  function createDedupWindow() {
    const hashes = new Set<string>();
    const order: string[] = [];

    return {
      isDuplicate(content: string): boolean {
        if (hashes.has(content)) return true;
        if (order.length >= WINDOW_SIZE) {
          const evicted = order.shift()!;
          hashes.delete(evicted);
        }
        hashes.add(content);
        order.push(content);
        return false;
      },
      size: () => hashes.size,
      clear() {
        hashes.clear();
        order.length = 0;
      },
    };
  }

  it("never exceeds window size", () => {
    const dedup = createDedupWindow();
    for (let i = 0; i < 200; i++) {
      dedup.isDuplicate(`msg-${i}`);
    }
    expect(dedup.size()).toBe(WINDOW_SIZE);
  });

  it("clear resets to zero", () => {
    const dedup = createDedupWindow();
    for (let i = 0; i < 30; i++) dedup.isDuplicate(`msg-${i}`);
    dedup.clear();
    expect(dedup.size()).toBe(0);
  });
});
