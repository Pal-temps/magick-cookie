import { describe, test, expect } from "bun:test";

// ─── Logic extracted from DailyStats.tsx ─────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("formatDuration", () => {
  // ── Sub-hour values ─────────────────────────────────────────────────────────

  test("0 seconds → '0min'", () => {
    expect(formatDuration(0)).toBe("0min");
  });

  test("59 seconds → '0min'", () => {
    expect(formatDuration(59)).toBe("0min");
  });

  test("60 seconds → '1min'", () => {
    expect(formatDuration(60)).toBe("1min");
  });

  test("90 seconds → '1min'", () => {
    expect(formatDuration(90)).toBe("1min");
  });

  test("30 minutes exactly", () => {
    expect(formatDuration(30 * 60)).toBe("30min");
  });

  test("59 minutes 59 seconds → '59min'", () => {
    expect(formatDuration(59 * 60 + 59)).toBe("59min");
  });

  // ── Hour boundary ───────────────────────────────────────────────────────────

  test("exactly 1 hour → '1h 0min'", () => {
    expect(formatDuration(3600)).toBe("1h 0min");
  });

  test("1 hour 30 minutes", () => {
    expect(formatDuration(3600 + 30 * 60)).toBe("1h 30min");
  });

  test("2 hours 0 minutes", () => {
    expect(formatDuration(2 * 3600)).toBe("2h 0min");
  });

  test("2 hours 15 minutes", () => {
    expect(formatDuration(2 * 3600 + 15 * 60)).toBe("2h 15min");
  });

  test("8 hours (full work day)", () => {
    expect(formatDuration(8 * 3600)).toBe("8h 0min");
  });

  test("remaining seconds are ignored (only full minutes counted)", () => {
    // 1h 29min 59s — should show 29min, not 30min
    expect(formatDuration(3600 + 29 * 60 + 59)).toBe("1h 29min");
  });

  // ── Output format ───────────────────────────────────────────────────────────

  test("sub-hour output never contains 'h'", () => {
    expect(formatDuration(45 * 60)).not.toContain("h");
  });

  test("hour output always contains 'h'", () => {
    expect(formatDuration(2 * 3600 + 10 * 60)).toContain("h");
  });

  test("output always ends with 'min'", () => {
    expect(formatDuration(0)).toMatch(/min$/);
    expect(formatDuration(3600)).toMatch(/min$/);
    expect(formatDuration(90 * 60)).toMatch(/min$/);
  });
});
