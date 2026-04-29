import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { createSSERoutes } from "../../presentation/routes/sse.routes";
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

describe("InMemoryReminderEmitter — subscription lifecycle", () => {
  it("subscriber receives emitted reminders", () => {
    const emitter = new InMemoryReminderEmitter();
    const received: string[] = [];
    emitter.subscribe((r) => received.push(r.id));
    emitter.emit(fakeReminder);
    expect(received).toEqual(["r1"]);
  });

  it("unsubscribe stops further deliveries", () => {
    const emitter = new InMemoryReminderEmitter();
    const received: string[] = [];
    const unsub = emitter.subscribe((r) => received.push(r.id));

    emitter.emit(fakeReminder);
    expect(received).toHaveLength(1);

    unsub();
    emitter.emit(fakeReminder);
    // No new delivery after unsubscribe
    expect(received).toHaveLength(1);
  });

  it("calling unsubscribe twice is a no-op", () => {
    const emitter = new InMemoryReminderEmitter();
    const received: string[] = [];
    const unsub = emitter.subscribe((r) => received.push(r.id));
    unsub();
    unsub(); // second call must not throw
    emitter.emit(fakeReminder);
    expect(received).toHaveLength(0);
  });

  it("multiple subscribers are independent", () => {
    const emitter = new InMemoryReminderEmitter();
    const a: string[] = [];
    const b: string[] = [];
    const unsubA = emitter.subscribe((r) => a.push(r.id));
    emitter.subscribe((r) => b.push(r.id));

    emitter.emit(fakeReminder);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);

    unsubA();
    emitter.emit(fakeReminder);
    // Only A was unsubscribed — B still receives
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);
  });
});

describe("SSE routes", () => {
  it("should return correct SSE headers (Content-Type and Cache-Control)", async () => {
    const emitter = new InMemoryReminderEmitter();
    const app = new Hono();
    app.route("/sse", createSSERoutes(emitter));

    const res = await app.request("/sse");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");
  });

  it("emitter delivers reminder to subscriber with correct JSON serialization", () => {
    const emitter = new InMemoryReminderEmitter();
    const received: string[] = [];

    emitter.subscribe((reminder) => {
      // Simulate what the SSE route does: JSON.stringify the reminder
      const json = JSON.stringify(reminder);
      received.push(json);
    });

    emitter.emit(fakeReminder);

    expect(received).toHaveLength(1);

    const parsed = JSON.parse(received[0]);
    expect(parsed.id).toBe("r1");
    expect(parsed.eventTitle).toBe("Team meeting");
    expect(parsed.eventStartAt).toBe("2026-03-13T14:00:00.000Z");
    expect(parsed.minutesBefore).toBe(15);
    expect(parsed.eventId).toBe("e1");
    expect(parsed.type).toBe("push");
  });
});
