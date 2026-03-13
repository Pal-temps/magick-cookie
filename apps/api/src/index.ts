import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config";
import { db } from "./infrastructure/database/client";
import { errorHandler } from "./presentation/middleware/error-handler";

// Repositories
import { DrizzleCalendarRepository } from "./infrastructure/repositories/calendar.repository.impl";
import { DrizzleEventRepository } from "./infrastructure/repositories/event.repository.impl";
import { DrizzleReminderRepository } from "./infrastructure/repositories/reminder.repository.impl";
import { DrizzleContactRepository } from "./infrastructure/repositories/contact.repository.impl";
import { DrizzleClickUpConnectorRepository } from "./infrastructure/repositories/clickup.repository.impl";

// Services
import { CalendarService } from "./application/calendar/calendar.service";
import { EventService } from "./application/event/event.service";
import { ReminderService } from "./application/reminder/reminder.service";
import { ContactService } from "./application/contact/contact.service";
import { ClickUpSyncService } from "./application/connector/clickup-sync.service";

// Connectors
import { ClickUpApiClient } from "./infrastructure/connectors/clickup-api.client";

// SSE
import { InMemoryReminderEmitter } from "./infrastructure/sse/reminder-emitter.impl";

// Routes
import { createCalendarRoutes } from "./presentation/routes/calendar.routes";
import { createEventRoutes, createCalendarEventRoutes } from "./presentation/routes/event.routes";
import { createReminderRoutes, createEventReminderRoutes } from "./presentation/routes/reminder.routes";
import { createSSERoutes } from "./presentation/routes/sse.routes";
import { createContactRoutes } from "./presentation/routes/contact.routes";
import { createConnectorRoutes } from "./presentation/routes/connector.routes";

// Jobs
import { startReminderChecker } from "./infrastructure/jobs/reminder-checker";

// --- DI ---
const calendarRepo = new DrizzleCalendarRepository(db);
const eventRepo = new DrizzleEventRepository(db);
const reminderRepo = new DrizzleReminderRepository(db);
const contactRepo = new DrizzleContactRepository(db);

const calendarService = new CalendarService(calendarRepo);
const eventService = new EventService(eventRepo, reminderRepo);
const reminderService = new ReminderService(reminderRepo, eventRepo);
const contactService = new ContactService(contactRepo);

const clickUpConnectorRepo = new DrizzleClickUpConnectorRepository(db);
const clickUpApiClient = new ClickUpApiClient(config.clickupApiToken);
const clickUpSyncService = new ClickUpSyncService(clickUpApiClient, calendarService, eventRepo, clickUpConnectorRepo);

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
app.route("/api/calendars/:calendarId/events", createCalendarEventRoutes(eventService));
app.route("/api/reminders", createReminderRoutes(reminderService));
app.route("/api/events/:eventId/reminders", createEventReminderRoutes(reminderService));
app.route("/api/sse", createSSERoutes(reminderEmitter));
app.route("/api/contacts", createContactRoutes(contactService));
app.route("/api/connectors", createConnectorRoutes(clickUpSyncService, clickUpConnectorRepo));

// Start reminder checker — pushes to SSE, does NOT mark as sent
startReminderChecker(reminderService, eventRepo, reminderEmitter);

export default {
  port: config.port,
  fetch: app.fetch,
};

console.log(`API running on http://localhost:${config.port}`);
