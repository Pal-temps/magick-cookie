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
import { DrizzleTimerSessionRepository } from "./infrastructure/repositories/timer-session.repository.impl";
import { DrizzleWellnessConfigRepository } from "./infrastructure/repositories/wellness-config.repository.impl";
import { DrizzleWellnessLogRepository } from "./infrastructure/repositories/wellness-log.repository.impl";
import { DrizzleDogWalkRepository } from "./infrastructure/repositories/dog-walk.repository.impl";

// Services
import { CalendarService } from "./application/calendar/calendar.service";
import { EventService } from "./application/event/event.service";
import { ReminderService } from "./application/reminder/reminder.service";
import { ContactService } from "./application/contact/contact.service";
import { ClickUpSyncService } from "./application/connector/clickup-sync.service";
import { TimerSessionService } from "./application/timer-session/timer-session.service";
import { WellnessConfigService } from "./application/wellness-config/wellness-config.service";
import { WellnessLogService } from "./application/wellness-log/wellness-log.service";
import { DogWalkService } from "./application/dog-walk/dog-walk.service";

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
import { createTimerSessionRoutes } from "./presentation/routes/timer-session.routes";
import { createWellnessConfigRoutes } from "./presentation/routes/wellness-config.routes";
import { createWellnessLogRoutes } from "./presentation/routes/wellness-log.routes";
import { createDogWalkRoutes } from "./presentation/routes/dog-walk.routes";

// Jobs
import { startReminderChecker } from "./infrastructure/jobs/reminder-checker";

// --- DI ---
const calendarRepo = new DrizzleCalendarRepository(db);
const eventRepo = new DrizzleEventRepository(db);
const reminderRepo = new DrizzleReminderRepository(db);
const contactRepo = new DrizzleContactRepository(db);
const timerSessionRepo = new DrizzleTimerSessionRepository(db);
const wellnessConfigRepo = new DrizzleWellnessConfigRepository(db);
const wellnessLogRepo = new DrizzleWellnessLogRepository(db);
const dogWalkRepo = new DrizzleDogWalkRepository(db);

const calendarService = new CalendarService(calendarRepo);
const eventService = new EventService(eventRepo, reminderRepo);
const reminderService = new ReminderService(reminderRepo, eventRepo);
const contactService = new ContactService(contactRepo);
const timerSessionService = new TimerSessionService(timerSessionRepo);
const wellnessConfigService = new WellnessConfigService(wellnessConfigRepo);
const wellnessLogService = new WellnessLogService(wellnessLogRepo);
const dogWalkService = new DogWalkService(dogWalkRepo);

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
app.route("/api/connectors", createConnectorRoutes(clickUpSyncService, clickUpConnectorRepo, clickUpApiClient));
app.route("/api/timer-sessions", createTimerSessionRoutes(timerSessionService));
app.route("/api/wellness-configs", createWellnessConfigRoutes(wellnessConfigService));
app.route("/api/wellness-logs", createWellnessLogRoutes(wellnessLogService));
app.route("/api/dog-walks", createDogWalkRoutes(dogWalkService));

// Start reminder checker — pushes to SSE, does NOT mark as sent
startReminderChecker(reminderService, eventRepo, reminderEmitter);

// Seed default wellness configs
wellnessConfigService.seedDefaults().catch(console.error);

export default {
  port: config.port,
  fetch: app.fetch,
};

console.log(`API running on http://localhost:${config.port}`);
