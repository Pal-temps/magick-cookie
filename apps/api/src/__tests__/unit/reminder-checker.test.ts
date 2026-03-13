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

describe("startReminderChecker", () => {
  let timer: ReturnType<typeof setInterval>;

  afterEach(() => {
    clearInterval(timer);
  });

  it("should emit pending reminders with event info via the emitter", async () => {
    const emitFn = mock(() => {});
    const emitter: ReminderEmitter = {
      subscribe: mock(() => () => {}),
      emit: emitFn,
    };

    const mockService = {
      getPending: mock(() => Promise.resolve([fakeReminder])),
    } as any;

    const mockEventRepo = {
      findById: mock(() => Promise.resolve(fakeEvent)),
    } as any;

    timer = startReminderChecker(mockService, mockEventRepo, emitter, 50);
    await new Promise((r) => setTimeout(r, 80));

    expect(mockService.getPending).toHaveBeenCalled();
    expect(mockEventRepo.findById).toHaveBeenCalledWith("e1");
    expect(emitFn).toHaveBeenCalledTimes(1);

    const emitted = emitFn.mock.calls[0] as unknown[];
    const payload = emitted[0] as any;
    expect(payload.eventTitle).toBe("Team meeting");
    expect(payload.id).toBe("r1");
  });

  it("should not re-emit already emitted reminders", async () => {
    const emitFn = mock(() => {});
    const emitter: ReminderEmitter = {
      subscribe: mock(() => () => {}),
      emit: emitFn,
    };

    const mockService = {
      getPending: mock(() => Promise.resolve([fakeReminder])),
    } as any;

    const mockEventRepo = {
      findById: mock(() => Promise.resolve(fakeEvent)),
    } as any;

    timer = startReminderChecker(mockService, mockEventRepo, emitter, 50);
    // Wait for 2 ticks
    await new Promise((r) => setTimeout(r, 130));

    // Should only emit once despite 2+ ticks
    expect(emitFn).toHaveBeenCalledTimes(1);
  });

  it("should not fail when no pending reminders", async () => {
    const emitFn = mock(() => {});
    const emitter: ReminderEmitter = {
      subscribe: mock(() => () => {}),
      emit: emitFn,
    };

    const mockService = {
      getPending: mock(() => Promise.resolve([])),
    } as any;

    const mockEventRepo = {} as any;

    timer = startReminderChecker(mockService, mockEventRepo, emitter, 50);
    await new Promise((r) => setTimeout(r, 80));

    expect(emitFn).not.toHaveBeenCalled();
  });
});
