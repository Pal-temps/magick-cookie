import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

import * as schema from "../../infrastructure/database/schema";
import { errorHandler } from "../../presentation/middleware/error-handler";

// Repositories
import { DrizzleCalendarRepository } from "../../infrastructure/repositories/calendar.repository.impl";
import { DrizzleEventRepository } from "../../infrastructure/repositories/event.repository.impl";
import { DrizzleReminderRepository } from "../../infrastructure/repositories/reminder.repository.impl";
import { DrizzleContactRepository } from "../../infrastructure/repositories/contact.repository.impl";

// Services
import { CalendarService } from "../../application/calendar/calendar.service";
import { EventService } from "../../application/event/event.service";
import { ReminderService } from "../../application/reminder/reminder.service";
import { ContactService } from "../../application/contact/contact.service";

// SSE
import { InMemoryReminderEmitter } from "../../infrastructure/sse/reminder-emitter.impl";

// Routes
import { createCalendarRoutes } from "../../presentation/routes/calendar.routes";
import { createEventRoutes, createCalendarEventRoutes } from "../../presentation/routes/event.routes";
import { createReminderRoutes, createEventReminderRoutes } from "../../presentation/routes/reminder.routes";
import { createContactRoutes } from "../../presentation/routes/contact.routes";
import { createSSERoutes } from "../../presentation/routes/sse.routes";

// --- Test Database ---
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:47532/do_it_now_test";

const queryClient = postgres(databaseUrl);
const db = drizzle(queryClient, { schema });

// --- DI ---
const calendarRepo = new DrizzleCalendarRepository(db);
const eventRepo = new DrizzleEventRepository(db);
const reminderRepo = new DrizzleReminderRepository(db);
const contactRepo = new DrizzleContactRepository(db);

const calendarService = new CalendarService(calendarRepo);
const eventService = new EventService(eventRepo, reminderRepo);
const reminderService = new ReminderService(reminderRepo, eventRepo);
const contactService = new ContactService(contactRepo);
const reminderEmitter = new InMemoryReminderEmitter();

// --- App ---
const app = new Hono();

app.use("/*", cors());
app.onError(errorHandler);

// Health
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/api/calendars", createCalendarRoutes(calendarService));
app.route("/api/events", createEventRoutes(eventService));
app.route(
  "/api/calendars/:calendarId/events",
  createCalendarEventRoutes(eventService),
);
app.route("/api/reminders", createReminderRoutes(reminderService));
app.route(
  "/api/events/:eventId/reminders",
  createEventReminderRoutes(reminderService),
);
app.route("/api/contacts", createContactRoutes(contactService));
app.route("/api/sse", createSSERoutes(reminderEmitter));

export const testApp = app;

/**
 * Helper to make requests against the test Hono app.
 */
export async function request(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
) {
  const init: RequestInit = { method };

  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  return testApp.request(path, init);
}

/**
 * Truncate all tables in dependency-safe order.
 */
export async function cleanDb() {
  await db.execute(sql`TRUNCATE TABLE reminders, events, calendars, contacts CASCADE`);
}

/**
 * Close the underlying postgres connection (call in afterAll).
 */
export async function closeDb() {
  await queryClient.end();
}
