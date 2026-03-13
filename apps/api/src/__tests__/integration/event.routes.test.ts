import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { request, cleanDb, closeDb } from "./setup";

let calendarId: string;

afterAll(async () => {
  await closeDb();
});

describe("Event routes", () => {
  beforeEach(async () => {
    await cleanDb();

    // Create a calendar to attach events to
    const res = await request("POST", "/api/calendars", {
      name: "Test Calendar",
    });
    const { data } = await res.json();
    calendarId = data.id;
  });

  function futureDate(hoursFromNow: number): string {
    return new Date(Date.now() + hoursFromNow * 3600_000).toISOString();
  }

  // ----------------------------------------------------------------
  // POST /api/calendars/:calendarId/events
  // ----------------------------------------------------------------
  describe("POST /api/calendars/:calendarId/events", () => {
    test("creates an event and returns 201", async () => {
      const res = await request(
        "POST",
        `/api/calendars/${calendarId}/events`,
        {
          title: "Team standup",
          startAt: futureDate(1),
          endAt: futureDate(2),
        },
      );

      expect(res.status).toBe(201);

      const { data } = await res.json();
      expect(data.title).toBe("Team standup");
      expect(data.calendarId).toBe(calendarId);
      expect(data.id).toBeDefined();
    });

    test("creates an event with reminders", async () => {
      const startAt = futureDate(24);
      const res = await request(
        "POST",
        `/api/calendars/${calendarId}/events`,
        {
          title: "Important meeting",
          startAt,
          endAt: futureDate(25),
          reminders: [{ minutesBefore: 15 }, { minutesBefore: 60 }],
        },
      );

      expect(res.status).toBe(201);

      const { data: event } = await res.json();

      // Verify reminders were created
      const remindersRes = await request(
        "GET",
        `/api/events/${event.id}/reminders`,
      );
      const { data: reminders } = await remindersRes.json();
      expect(reminders).toHaveLength(2);

      const minutesValues = reminders
        .map((r: any) => r.minutesBefore)
        .sort((a: number, b: number) => a - b);
      expect(minutesValues).toEqual([15, 60]);
    });

    test("returns 400 with invalid body", async () => {
      const res = await request(
        "POST",
        `/api/calendars/${calendarId}/events`,
        {
          title: "",
          startAt: "not-a-date",
          endAt: "also-not",
        },
      );

      expect(res.status).toBe(400);
    });
  });

  // ----------------------------------------------------------------
  // GET /api/events?from=&to=
  // ----------------------------------------------------------------
  describe("GET /api/events", () => {
    test("filters events by date range", async () => {
      const now = Date.now();

      // Event in range
      await request("POST", `/api/calendars/${calendarId}/events`, {
        title: "In range",
        startAt: new Date(now + 2 * 3600_000).toISOString(),
        endAt: new Date(now + 3 * 3600_000).toISOString(),
      });

      // Event out of range (far future)
      await request("POST", `/api/calendars/${calendarId}/events`, {
        title: "Out of range",
        startAt: new Date(now + 30 * 24 * 3600_000).toISOString(),
        endAt: new Date(now + 31 * 24 * 3600_000).toISOString(),
      });

      const from = new Date(now).toISOString();
      const to = new Date(now + 24 * 3600_000).toISOString();

      const res = await request(
        "GET",
        `/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe("In range");
    });

    test("returns all events when no filters given", async () => {
      await request("POST", `/api/calendars/${calendarId}/events`, {
        title: "Event A",
        startAt: futureDate(1),
        endAt: futureDate(2),
      });
      await request("POST", `/api/calendars/${calendarId}/events`, {
        title: "Event B",
        startAt: futureDate(3),
        endAt: futureDate(4),
      });

      const res = await request("GET", "/api/events");
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------------
  // GET /api/events/:id
  // ----------------------------------------------------------------
  describe("GET /api/events/:id", () => {
    test("returns an event by id", async () => {
      const createRes = await request(
        "POST",
        `/api/calendars/${calendarId}/events`,
        {
          title: "My event",
          startAt: futureDate(1),
          endAt: futureDate(2),
        },
      );
      const { data: created } = await createRes.json();

      const res = await request("GET", `/api/events/${created.id}`);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.id).toBe(created.id);
      expect(data.title).toBe("My event");
    });

    test("returns 404 for non-existent event", async () => {
      const res = await request(
        "GET",
        "/api/events/00000000-0000-0000-0000-000000000000",
      );
      expect(res.status).toBe(404);
    });
  });

  // ----------------------------------------------------------------
  // PUT /api/events/:id
  // ----------------------------------------------------------------
  describe("PUT /api/events/:id", () => {
    test("updates an event title", async () => {
      const createRes = await request(
        "POST",
        `/api/calendars/${calendarId}/events`,
        {
          title: "Old Title",
          startAt: futureDate(1),
          endAt: futureDate(2),
        },
      );
      const { data: created } = await createRes.json();

      const res = await request("PUT", `/api/events/${created.id}`, {
        title: "Updated Title",
      });

      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.title).toBe("Updated Title");
    });

    test("returns 404 for non-existent event", async () => {
      const res = await request(
        "PUT",
        "/api/events/00000000-0000-0000-0000-000000000000",
        { title: "Nope" },
      );
      expect(res.status).toBe(404);
    });
  });

  // ----------------------------------------------------------------
  // DELETE /api/events/:id
  // ----------------------------------------------------------------
  describe("DELETE /api/events/:id", () => {
    test("deletes an event", async () => {
      const createRes = await request(
        "POST",
        `/api/calendars/${calendarId}/events`,
        {
          title: "To Delete",
          startAt: futureDate(1),
          endAt: futureDate(2),
        },
      );
      const { data: created } = await createRes.json();

      const deleteRes = await request("DELETE", `/api/events/${created.id}`);
      expect(deleteRes.status).toBe(200);

      const { data } = await deleteRes.json();
      expect(data.success).toBe(true);

      // Verify it's gone
      const getRes = await request("GET", `/api/events/${created.id}`);
      expect(getRes.status).toBe(404);
    });

    test("returns 404 for non-existent event", async () => {
      const res = await request(
        "DELETE",
        "/api/events/00000000-0000-0000-0000-000000000000",
      );
      expect(res.status).toBe(404);
    });
  });
});
