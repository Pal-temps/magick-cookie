import { describe, it, expect, mock, afterEach } from "bun:test";
import { startReminderChecker } from "../../infrastructure/jobs/reminder-checker";
import type { ReminderEmitter } from "../../domain/reminder/reminder-emitter";
import type { Reminder } from "../../domain/reminder/reminder.entity";

const fakeReminder: Reminder = {
  id: "r1",
  eventId: "e1",
  type: "push",
  minutesBefore: 15,
  scheduledAt: new Date("2026-03-13T13:45:00Z"),
  sentAt: null,
  createdAt: new Date("2026-03-13T00:00:00Z"),
};

const fakeEvent = {
  id: "e1",
  calendarId: "c1",
  title: "Team meeting",
  description: null,
  location: null,
  startAt: new Date("2026-03-13T14:00:00Z"),
  endAt: new Date("2026-03-13T15:00:00Z"),
  isAllDay: false,
  recurrenceRule: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createEmitter() {
  const emitFn = mock(() => {});
  const emitter: ReminderEmitter = {
    subscribe: mock(() => () => {}),
    emit: emitFn,
  };
  return { emitter, emitFn };
}

describe("reminder-checker dedup behavior", () => {
  let timer: ReturnType<typeof setInterval>;

  afterEach(() => {
    clearInterval(timer);
  });

  it("should emit a reminder only once across multiple ticks", async () => {
    const { emitter, emitFn } = createEmitter();

    const mockService = {
      getPending: mock(() => Promise.resolve([fakeReminder])),
    } as any;

    const mockEventRepo = {
      findById: mock(() => Promise.resolve(fakeEvent)),
    } as any;

    timer = startReminderChecker(mockService, mockEventRepo, emitter, 50);

    // Wait for ~4 ticks (200ms with 50ms interval)
    await new Promise((r) => setTimeout(r, 220));

    // Despite multiple ticks, emit should have been called only once
    expect(emitFn).toHaveBeenCalledTimes(1);
    // getPending should have been called multiple times
    expect(mockService.getPending.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("should re-emit a reminder after it disappears and reappears with a different id", async () => {
    const { emitter, emitFn } = createEmitter();

    const reminder2: Reminder = {
      ...fakeReminder,
      id: "r2",
    };

    let callCount = 0;
    const mockService = {
      getPending: mock(() => {
        callCount++;
        if (callCount <= 2) {
          // First 2 ticks: original reminder
          return Promise.resolve([fakeReminder]);
        }
        if (callCount === 3) {
          // Tick 3: reminder gone (acked)
          return Promise.resolve([]);
        }
        // Tick 4+: new reminder with different id for same event
        return Promise.resolve([reminder2]);
      }),
    } as any;

    const mockEventRepo = {
      findById: mock(() => Promise.resolve(fakeEvent)),
    } as any;

    timer = startReminderChecker(mockService, mockEventRepo, emitter, 50);

    // Wait for enough ticks
    await new Promise((r) => setTimeout(r, 280));

    // Should have emitted twice: once for r1, once for r2
    expect(emitFn).toHaveBeenCalledTimes(2);
    const firstPayload = (emitFn.mock.calls[0] as any[])[0];
    const secondPayload = (emitFn.mock.calls[1] as any[])[0];
    expect(firstPayload.id).toBe("r1");
    expect(secondPayload.id).toBe("r2");
  });

  it("should cleanup emitted set when reminder is no longer pending", async () => {
    const { emitter, emitFn } = createEmitter();

    let callCount = 0;
    const mockService = {
      getPending: mock(() => {
        callCount++;
        if (callCount === 1) {
          // Tick 1: reminder present
          return Promise.resolve([fakeReminder]);
        }
        if (callCount === 2) {
          // Tick 2: reminder gone (acked/deleted) — triggers cleanup
          return Promise.resolve([]);
        }
        // Tick 3+: same reminder reappears (e.g. un-acked somehow)
        return Promise.resolve([fakeReminder]);
      }),
    } as any;

    const mockEventRepo = {
      findById: mock(() => Promise.resolve(fakeEvent)),
    } as any;

    timer = startReminderChecker(mockService, mockEventRepo, emitter, 50);

    // Wait for 3+ ticks
    await new Promise((r) => setTimeout(r, 220));

    // Should have emitted twice: tick 1 and tick 3 (after cleanup on tick 2)
    expect(emitFn).toHaveBeenCalledTimes(2);
  });

  it("should skip reminder if event is not found in DB", async () => {
    const { emitter, emitFn } = createEmitter();

    const mockService = {
      getPending: mock(() => Promise.resolve([fakeReminder])),
    } as any;

    const mockEventRepo = {
      findById: mock(() => Promise.resolve(null)),
    } as any;

    timer = startReminderChecker(mockService, mockEventRepo, emitter, 50);
    await new Promise((r) => setTimeout(r, 80));

    // emit should NOT have been called since event was not found
    expect(emitFn).not.toHaveBeenCalled();
    expect(mockEventRepo.findById).toHaveBeenCalledWith("e1");
  });

  it("should include eventTitle and eventStartAt in emitted payload", async () => {
    const { emitter, emitFn } = createEmitter();

    const mockService = {
      getPending: mock(() => Promise.resolve([fakeReminder])),
    } as any;

    const mockEventRepo = {
      findById: mock(() => Promise.resolve(fakeEvent)),
    } as any;

    timer = startReminderChecker(mockService, mockEventRepo, emitter, 50);
    await new Promise((r) => setTimeout(r, 80));

    expect(emitFn).toHaveBeenCalledTimes(1);
    const payload = (emitFn.mock.calls[0] as any[])[0];
    expect(payload.eventTitle).toBe("Team meeting");
    expect(payload.eventStartAt).toEqual(new Date("2026-03-13T14:00:00Z"));
    expect(payload.id).toBe("r1");
    expect(payload.eventId).toBe("e1");
    expect(payload.minutesBefore).toBe(15);
  });
});
