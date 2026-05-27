import { describe, test, expect } from "bun:test";

// ─── Types (mirrored from EventCard.tsx) ───────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  calendarId: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  taskId?: string;
  _isBirthday?: boolean;
  _isAlarm?: boolean;
}

interface SourceBadge {
  label: string;
  color: string;
  isAccent?: boolean;
}

// ─── Logic extracted from EventCard.tsx ───────────────────────────────────────

const SOURCE_BADGE: Record<string, SourceBadge> = {
  task: { label: "T", color: "var(--accent-primary)", isAccent: true },
  personal: { label: "P", color: "#00b894" },
  birthday: { label: "AN", color: "#fd79a8" },
  alarm: { label: "A", color: "#e17055" },
};

function getEventSource(event: CalendarEvent): string {
  if (event._isAlarm) return "alarm";
  if (event._isBirthday) return "birthday";
  if (event.taskId) return "task";
  return "personal";
}

function getBadge(event: CalendarEvent): SourceBadge {
  return SOURCE_BADGE[getEventSource(event)];
}

/**
 * Resolves the background CSS expression for the source badge.
 * Mirrors EventCard.tsx inline style logic.
 */
function badgeBackground(badge: SourceBadge): string {
  return badge.isAccent
    ? "color-mix(in srgb, var(--accent-primary) 20%, transparent)"
    : `${badge.color}33`;
}

/**
 * Resolves the text color CSS expression for the source badge.
 */
function badgeColor(badge: SourceBadge): string {
  return badge.isAccent ? "var(--accent-primary)" : badge.color;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    title: "Test event",
    calendarId: "cal-1",
    startAt: "2026-05-27T10:00:00.000Z",
    endAt: "2026-05-27T11:00:00.000Z",
    isAllDay: false,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getEventSource", () => {
  test("returns 'alarm' for alarm events (highest priority)", () => {
    const event = makeEvent({ _isAlarm: true, _isBirthday: true, taskId: "t-1" });
    expect(getEventSource(event)).toBe("alarm");
  });

  test("returns 'birthday' for birthday events", () => {
    const event = makeEvent({ _isBirthday: true, taskId: "t-1" });
    expect(getEventSource(event)).toBe("birthday");
  });

  test("returns 'task' when taskId is present", () => {
    const event = makeEvent({ taskId: "task-123" });
    expect(getEventSource(event)).toBe("task");
  });

  test("returns 'personal' for regular events", () => {
    const event = makeEvent();
    expect(getEventSource(event)).toBe("personal");
  });

  test("returns 'personal' when taskId is undefined", () => {
    const event = makeEvent({ taskId: undefined });
    expect(getEventSource(event)).toBe("personal");
  });
});

describe("SOURCE_BADGE — isAccent flag", () => {
  test("task badge has isAccent: true", () => {
    expect(SOURCE_BADGE.task.isAccent).toBe(true);
  });

  test("personal badge has no isAccent flag", () => {
    expect(SOURCE_BADGE.personal.isAccent).toBeUndefined();
  });

  test("birthday badge has no isAccent flag", () => {
    expect(SOURCE_BADGE.birthday.isAccent).toBeUndefined();
  });

  test("alarm badge has no isAccent flag", () => {
    expect(SOURCE_BADGE.alarm.isAccent).toBeUndefined();
  });

  test("task badge uses CSS variable for color (not hardcoded hex)", () => {
    expect(SOURCE_BADGE.task.color).toBe("var(--accent-primary)");
  });
});

describe("badge background — isAccent guard", () => {
  test("task (isAccent) uses color-mix, not hex concatenation", () => {
    const badge = getBadge(makeEvent({ taskId: "t-1" }));
    const bg = badgeBackground(badge);
    expect(bg).toBe("color-mix(in srgb, var(--accent-primary) 20%, transparent)");
    // Must NOT contain raw hex concatenation
    expect(bg).not.toMatch(/var\(--[^)]+\)33$/);
  });

  test("personal badge background is hex with alpha suffix", () => {
    const badge = getBadge(makeEvent());
    const bg = badgeBackground(badge);
    expect(bg).toBe("#00b89433");
  });

  test("birthday badge background is hex with alpha suffix", () => {
    const badge = getBadge(makeEvent({ _isBirthday: true }));
    const bg = badgeBackground(badge);
    expect(bg).toBe("#fd79a833");
  });

  test("alarm badge background is hex with alpha suffix", () => {
    const badge = getBadge(makeEvent({ _isAlarm: true }));
    const bg = badgeBackground(badge);
    expect(bg).toBe("#e1705533");
  });
});

describe("badge color — isAccent guard", () => {
  test("task color delegates to CSS variable", () => {
    const badge = getBadge(makeEvent({ taskId: "t-1" }));
    expect(badgeColor(badge)).toBe("var(--accent-primary)");
  });

  test("non-accent badges use their raw hex color", () => {
    const personalBadge = getBadge(makeEvent());
    expect(badgeColor(personalBadge)).toBe("#00b894");
  });
});

describe("badge labels", () => {
  test("task label is 'T'", () => {
    expect(SOURCE_BADGE.task.label).toBe("T");
  });

  test("personal label is 'P'", () => {
    expect(SOURCE_BADGE.personal.label).toBe("P");
  });

  test("birthday label is 'AN'", () => {
    expect(SOURCE_BADGE.birthday.label).toBe("AN");
  });

  test("alarm label is 'A'", () => {
    expect(SOURCE_BADGE.alarm.label).toBe("A");
  });
});
