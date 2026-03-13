import { describe, it, expect, mock } from "bun:test";
import { InMemoryReminderEmitter } from "../../infrastructure/sse/reminder-emitter.impl";
import type { ReminderWithEvent } from "../../domain/reminder/reminder-emitter";

const fakeReminder: ReminderWithEvent = {
  id: "r1",
  eventId: "e1",
  type: "push",
  minutesBefore: 15,
  scheduledAt: new Date("2026-03-13T13:45:00Z"),
  sentAt: null,
  createdAt: new Date("2026-03-13T00:00:00Z"),
  eventTitle: "Team meeting",
  eventStartAt: new Date("2026-03-13T14:00:00Z"),
};

describe("InMemoryReminderEmitter", () => {
  it("should notify subscribed listeners on emit", () => {
    const emitter = new InMemoryReminderEmitter();
    const listener = mock(() => {});

    emitter.subscribe(listener);
    emitter.emit(fakeReminder);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(fakeReminder);
  });

  it("should notify multiple listeners", () => {
    const emitter = new InMemoryReminderEmitter();
    const listener1 = mock(() => {});
    const listener2 = mock(() => {});

    emitter.subscribe(listener1);
    emitter.subscribe(listener2);
    emitter.emit(fakeReminder);

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it("should stop notifying after unsubscribe", () => {
    const emitter = new InMemoryReminderEmitter();
    const listener = mock(() => {});

    const unsubscribe = emitter.subscribe(listener);
    emitter.emit(fakeReminder);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    emitter.emit(fakeReminder);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should not fail when emitting with no listeners", () => {
    const emitter = new InMemoryReminderEmitter();
    expect(() => emitter.emit(fakeReminder)).not.toThrow();
  });
});
