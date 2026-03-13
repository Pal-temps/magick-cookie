import { describe, it, expect } from "bun:test";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
const BASE = `http://localhost:${process.env.TEST_PORT || 47300}/api`;

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

// ---------------------------------------------------------------------------
// a) Full calendar lifecycle
// ---------------------------------------------------------------------------
describe("Full calendar lifecycle", () => {
  let calendarId: string;

  it("should create a calendar", async () => {
    const { status, data } = await api("POST", "/calendars", {
      name: "E2E Lifecycle",
      color: "#FF0000",
    });
    expect(status).toBe(201);
    expect(data.data.name).toBe("E2E Lifecycle");
    expect(data.data.color).toBe("#FF0000");
    calendarId = data.data.id;
  });

  it("should appear in the list", async () => {
    const { status, data } = await api("GET", "/calendars");
    expect(status).toBe(200);
    const ids = data.data.map((c: any) => c.id);
    expect(ids).toContain(calendarId);
  });

  it("should update the color", async () => {
    const { status, data } = await api("PUT", `/calendars/${calendarId}`, {
      color: "#00FF00",
    });
    expect(status).toBe(200);
    expect(data.data.color).toBe("#00FF00");
  });

  it("should delete the calendar", async () => {
    const { status, data } = await api("DELETE", `/calendars/${calendarId}`);
    expect(status).toBe(200);
    expect(data.data.success).toBe(true);
  });

  it("should no longer appear in the list", async () => {
    const { status, data } = await api("GET", "/calendars");
    expect(status).toBe(200);
    const ids = data.data.map((c: any) => c.id);
    expect(ids).not.toContain(calendarId);
  });
});

// ---------------------------------------------------------------------------
// b) Event with reminders (cascade delete)
// ---------------------------------------------------------------------------
describe("Event with reminders and cascade delete", () => {
  let calendarId: string;
  let eventId: string;

  it("should create a calendar", async () => {
    const { status, data } = await api("POST", "/calendars", {
      name: "Reminder Cal",
    });
    expect(status).toBe(201);
    calendarId = data.data.id;
  });

  it("should create an event with an immediate reminder (minutesBefore: 0)", async () => {
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60 * 1000);

    const { status, data } = await api(
      "POST",
      `/calendars/${calendarId}/events`,
      {
        title: "Reminder Event",
        startAt: now.toISOString(),
        endAt: later.toISOString(),
        reminders: [{ minutesBefore: 0 }],
      },
    );
    expect(status).toBe(201);
    expect(data.data.title).toBe("Reminder Event");
    eventId = data.data.id;
  });

  it("should show the reminder as pending", async () => {
    const { status, data } = await api("GET", "/reminders/pending");
    expect(status).toBe(200);
    const eventIds = data.data.map((r: any) => r.eventId);
    expect(eventIds).toContain(eventId);
  });

  it("should delete the event", async () => {
    const { status } = await api("DELETE", `/events/${eventId}`);
    expect(status).toBe(200);
  });

  it("should have removed the reminder via cascade", async () => {
    const { status, data } = await api("GET", "/reminders/pending");
    expect(status).toBe(200);
    const eventIds = data.data.map((r: any) => r.eventId);
    expect(eventIds).not.toContain(eventId);
  });

  // Cleanup
  it("cleanup: delete the calendar", async () => {
    await api("DELETE", `/calendars/${calendarId}`);
  });
});

// ---------------------------------------------------------------------------
// c) Date range filtering
// ---------------------------------------------------------------------------
describe("Date range filtering", () => {
  let calendarId: string;

  it("should create a calendar and 3 events (past, present, future)", async () => {
    const { data } = await api("POST", "/calendars", {
      name: "Range Cal",
    });
    calendarId = data.data.id;

    const now = new Date();
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later

    const makeEnd = (start: Date) =>
      new Date(start.getTime() + 60 * 60 * 1000);

    // Past event
    await api("POST", `/calendars/${calendarId}/events`, {
      title: "Past Event",
      startAt: past.toISOString(),
      endAt: makeEnd(past).toISOString(),
    });

    // Present event (now)
    await api("POST", `/calendars/${calendarId}/events`, {
      title: "Present Event",
      startAt: now.toISOString(),
      endAt: makeEnd(now).toISOString(),
    });

    // Future event
    await api("POST", `/calendars/${calendarId}/events`, {
      title: "Future Event",
      startAt: future.toISOString(),
      endAt: makeEnd(future).toISOString(),
    });
  });

  it("should return only the present event for a narrow date range", async () => {
    const now = new Date();
    const from = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours before now
    const to = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours after now

    const { status, data } = await api(
      "GET",
      `/calendars/${calendarId}/events?from=${from.toISOString()}&to=${to.toISOString()}`,
    );
    expect(status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].title).toBe("Present Event");
  });

  // Cleanup
  it("cleanup: delete the calendar", async () => {
    await api("DELETE", `/calendars/${calendarId}`);
  });
});

// ---------------------------------------------------------------------------
// d) Validation errors
// ---------------------------------------------------------------------------
describe("Validation errors", () => {
  it("should reject a calendar with empty name", async () => {
    const { status } = await api("POST", "/calendars", { name: "" });
    expect(status).toBe(400);
  });

  it("should reject an event with missing dates", async () => {
    // We need a real calendar id for the URL, but validation should fail before
    // the service layer tries to use it.
    const { data } = await api("POST", "/calendars", {
      name: "Validation Cal",
    });
    const calendarId = data.data.id;

    const { status } = await api(
      "POST",
      `/calendars/${calendarId}/events`,
      { title: "No Dates" },
    );
    expect(status).toBe(400);

    // Cleanup
    await api("DELETE", `/calendars/${calendarId}`);
  });
});

// ---------------------------------------------------------------------------
// e) Not found handling
// ---------------------------------------------------------------------------
describe("Not found handling", () => {
  it("GET /api/calendars/:id should return 404 for unknown UUID", async () => {
    const { status, data } = await api("GET", `/calendars/${NIL_UUID}`);
    expect(status).toBe(404);
    expect(data.error).toBeDefined();
  });

  it("DELETE /api/calendars/:id should return 404 for unknown UUID", async () => {
    const { status, data } = await api("DELETE", `/calendars/${NIL_UUID}`);
    expect(status).toBe(404);
    expect(data.error).toBeDefined();
  });
});
