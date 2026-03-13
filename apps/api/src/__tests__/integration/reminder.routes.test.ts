import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { request, cleanDb, closeDb } from "./setup";

let calendarId: string;
let eventId: string;

afterAll(async () => {
  await closeDb();
});

describe("Reminder routes", () => {
  beforeEach(async () => {
    await cleanDb();

    // Create a calendar
    const calRes = await request("POST", "/api/calendars", {
      name: "Test Calendar",
    });
    const { data: cal } = await calRes.json();
    calendarId = cal.id;

    // Create an event starting 2 hours from now
    const startAt = new Date(Date.now() + 2 * 3600_000).toISOString();
    const endAt = new Date(Date.now() + 3 * 3600_000).toISOString();

    const eventRes = await request(
      "POST",
      `/api/calendars/${calendarId}/events`,
      {
        title: "Test Event",
        startAt,
        endAt,
      },
    );
    const { data: ev } = await eventRes.json();
    eventId = ev.id;
  });

  // ----------------------------------------------------------------
  // POST /api/events/:eventId/reminders
  // ----------------------------------------------------------------
  describe("POST /api/events/:eventId/reminders", () => {
    test("creates a reminder and returns 201", async () => {
      const res = await request(
        "POST",
        `/api/events/${eventId}/reminders`,
        { minutesBefore: 30 },
      );

      expect(res.status).toBe(201);

      const { data } = await res.json();
      expect(data.eventId).toBe(eventId);
      expect(data.minutesBefore).toBe(30);
      expect(data.id).toBeDefined();
      expect(data.scheduledAt).toBeDefined();
    });

    test("creates a reminder with default minutesBefore", async () => {
      const res = await request(
        "POST",
        `/api/events/${eventId}/reminders`,
        {},
      );

      expect(res.status).toBe(201);

      const { data } = await res.json();
      expect(data.minutesBefore).toBe(15);
    });
  });

  // ----------------------------------------------------------------
  // GET /api/events/:eventId/reminders
  // ----------------------------------------------------------------
  describe("GET /api/events/:eventId/reminders", () => {
    test("lists reminders for an event", async () => {
      await request("POST", `/api/events/${eventId}/reminders`, {
        minutesBefore: 10,
      });
      await request("POST", `/api/events/${eventId}/reminders`, {
        minutesBefore: 60,
      });

      const res = await request("GET", `/api/events/${eventId}/reminders`);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data).toHaveLength(2);
    });

    test("returns empty array when event has no reminders", async () => {
      const res = await request("GET", `/api/events/${eventId}/reminders`);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data).toEqual([]);
    });
  });

  // ----------------------------------------------------------------
  // GET /api/reminders/pending
  // ----------------------------------------------------------------
  describe("GET /api/reminders/pending", () => {
    test("returns reminders where scheduledAt is in the past", async () => {
      // Create an event that starts 1 minute from now
      const soonStart = new Date(Date.now() + 60_000).toISOString();
      const soonEnd = new Date(Date.now() + 2 * 3600_000).toISOString();

      const soonRes = await request(
        "POST",
        `/api/calendars/${calendarId}/events`,
        {
          title: "Soon Event",
          startAt: soonStart,
          endAt: soonEnd,
        },
      );
      const { data: soonEvent } = await soonRes.json();

      // Create a reminder with minutesBefore = 5 => scheduledAt is 4 minutes in the past
      await request("POST", `/api/events/${soonEvent.id}/reminders`, {
        minutesBefore: 5,
      });

      // Create a reminder on the far-future event (not pending)
      await request("POST", `/api/events/${eventId}/reminders`, {
        minutesBefore: 15,
      });

      const res = await request("GET", "/api/reminders/pending");
      expect(res.status).toBe(200);

      const { data } = await res.json();
      // Only the "soon" reminder should be pending
      expect(data).toHaveLength(1);
      expect(data[0].eventId).toBe(soonEvent.id);
    });

    test("returns empty when no reminders are pending", async () => {
      // Add a reminder far in the future (event starts in 2 hours, minutesBefore=15)
      await request("POST", `/api/events/${eventId}/reminders`, {
        minutesBefore: 15,
      });

      const res = await request("GET", "/api/reminders/pending");
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data).toEqual([]);
    });
  });

  // ----------------------------------------------------------------
  // POST /api/reminders/:id/ack
  // ----------------------------------------------------------------
  describe("POST /api/reminders/:id/ack", () => {
    test("marks a reminder as sent", async () => {
      // Create event starting soon + reminder already pending
      const soonStart = new Date(Date.now() + 60_000).toISOString();
      const soonEnd = new Date(Date.now() + 2 * 3600_000).toISOString();

      const eventRes = await request(
        "POST",
        `/api/calendars/${calendarId}/events`,
        { title: "Soon Event", startAt: soonStart, endAt: soonEnd },
      );
      const { data: soonEvent } = await eventRes.json();

      const createRes = await request(
        "POST",
        `/api/events/${soonEvent.id}/reminders`,
        { minutesBefore: 5 },
      );
      const { data: reminder } = await createRes.json();

      // Ack the reminder
      const ackRes = await request("POST", `/api/reminders/${reminder.id}/ack`);
      expect(ackRes.status).toBe(200);

      const { data } = await ackRes.json();
      expect(data.success).toBe(true);

      // Should no longer appear in pending
      const pendingRes = await request("GET", "/api/reminders/pending");
      const { data: pending } = await pendingRes.json();
      const found = pending.find((r: any) => r.id === reminder.id);
      expect(found).toBeUndefined();
    });

    test("acking a reminder twice should not fail", async () => {
      const soonStart = new Date(Date.now() + 60_000).toISOString();
      const soonEnd = new Date(Date.now() + 2 * 3600_000).toISOString();

      const eventRes = await request(
        "POST",
        `/api/calendars/${calendarId}/events`,
        { title: "Soon Event", startAt: soonStart, endAt: soonEnd },
      );
      const { data: soonEvent } = await eventRes.json();

      const createRes = await request(
        "POST",
        `/api/events/${soonEvent.id}/reminders`,
        { minutesBefore: 5 },
      );
      const { data: reminder } = await createRes.json();

      // First ack
      const ack1 = await request("POST", `/api/reminders/${reminder.id}/ack`);
      expect(ack1.status).toBe(200);

      // Second ack — should still succeed
      const ack2 = await request("POST", `/api/reminders/${reminder.id}/ack`);
      expect(ack2.status).toBe(200);

      const { data } = await ack2.json();
      expect(data.success).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // DELETE /api/reminders/:id
  // ----------------------------------------------------------------
  describe("DELETE /api/reminders/:id", () => {
    test("deletes a reminder", async () => {
      const createRes = await request(
        "POST",
        `/api/events/${eventId}/reminders`,
        { minutesBefore: 10 },
      );
      const { data: created } = await createRes.json();

      const deleteRes = await request("DELETE", `/api/reminders/${created.id}`);
      expect(deleteRes.status).toBe(200);

      const { data } = await deleteRes.json();
      expect(data.success).toBe(true);

      // Verify it's gone from the event's reminders
      const listRes = await request(
        "GET",
        `/api/events/${eventId}/reminders`,
      );
      const { data: remaining } = await listRes.json();
      expect(remaining).toEqual([]);
    });

    test("returns 404 for non-existent reminder", async () => {
      const res = await request(
        "DELETE",
        "/api/reminders/00000000-0000-0000-0000-000000000000",
      );
      expect(res.status).toBe(404);
    });
  });
});
