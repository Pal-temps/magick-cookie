// ---------------------------------------------------------------------------
// k6 Load / Stress Test for do-it-now API
// ---------------------------------------------------------------------------
// Usage: k6 run apps/api/tests/load/k6-stress.js
// With custom URL: k6 run -e API_URL=http://localhost:47300/api apps/api/tests/load/k6-stress.js
// ---------------------------------------------------------------------------

import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.API_URL || "http://localhost:47300/api";

const headers = { "Content-Type": "application/json" };

export const options = {
  stages: [
    { duration: "30s", target: 20 }, // ramp up
    { duration: "1m", target: 50 }, // sustained
    { duration: "30s", target: 100 }, // peak
    { duration: "30s", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<200"], // 95% under 200ms
    http_req_failed: ["rate<0.01"], // <1% errors
  },
};

export default function () {
  // 1. Create a calendar
  const calRes = http.post(
    `${BASE}/calendars`,
    JSON.stringify({ name: `k6-cal-${__VU}-${__ITER}`, color: "#3366FF" }),
    { headers },
  );
  check(calRes, {
    "calendar created (201)": (r) => r.status === 201,
  });

  const calendarId = calRes.json("data.id");
  if (!calendarId) return;

  // 2. Create an event in that calendar
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);

  const eventRes = http.post(
    `${BASE}/calendars/${calendarId}/events`,
    JSON.stringify({
      title: `k6-event-${__VU}-${__ITER}`,
      startAt: now.toISOString(),
      endAt: later.toISOString(),
      reminders: [{ minutesBefore: 0 }],
    }),
    { headers },
  );
  check(eventRes, {
    "event created (201)": (r) => r.status === 201,
  });

  const eventId = eventRes.json("data.id");
  if (!eventId) return;

  // 3. List events with date range
  const from = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const listRes = http.get(
    `${BASE}/calendars/${calendarId}/events?from=${from}&to=${to}`,
  );
  check(listRes, {
    "list events (200)": (r) => r.status === 200,
    "list contains event": (r) => {
      const events = r.json("data");
      return Array.isArray(events) && events.length >= 1;
    },
  });

  // 4. Get pending reminders
  const pendingRes = http.get(`${BASE}/reminders/pending`);
  check(pendingRes, {
    "pending reminders (200)": (r) => r.status === 200,
  });

  // 5. Delete the event
  const delEventRes = http.del(`${BASE}/events/${eventId}`);
  check(delEventRes, {
    "event deleted (200)": (r) => r.status === 200,
  });

  // 6. Delete the calendar
  const delCalRes = http.del(`${BASE}/calendars/${calendarId}`);
  check(delCalRes, {
    "calendar deleted (200)": (r) => r.status === 200,
  });

  // 7. Sleep between iterations
  sleep(1);
}
