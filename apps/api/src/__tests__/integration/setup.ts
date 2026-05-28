import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { sql } from "drizzle-orm";

import * as schema from "../../infrastructure/database/schema";
import { errorHandler } from "../../presentation/middleware/error-handler";

// Repositories
import { DrizzleCalendarRepository } from "../../infrastructure/repositories/calendar.repository.impl";
import { DrizzleEventRepository } from "../../infrastructure/repositories/event.repository.impl";
import { DrizzleReminderRepository } from "../../infrastructure/repositories/reminder.repository.impl";
import { DrizzleContactRepository } from "../../infrastructure/repositories/contact.repository.impl";
import { DrizzleEmailAccountRepository } from "../../infrastructure/repositories/email-account.repository.impl";
import { DrizzleEmailRepository } from "../../infrastructure/repositories/email.repository.impl";
import { DrizzleConnectorConfigRepository } from "../../infrastructure/repositories/connector-config.repository.impl";
import { DrizzleLlmConfigRepository } from "../../infrastructure/repositories/llm-config.repository.impl";

// Services
import { CalendarService } from "../../application/calendar/calendar.service";
import { EventService } from "../../application/event/event.service";
import { ReminderService } from "../../application/reminder/reminder.service";
import { ContactService } from "../../application/contact/contact.service";
import { EmailService } from "../../application/email/email.service";
import { ConnectorConfigService } from "../../application/connector-config/connector-config.service";
import { LlmService } from "../../application/llm/llm.service";

// SSE
import { InMemoryReminderEmitter } from "../../infrastructure/sse/reminder-emitter.impl";

// Routes
import { createCalendarRoutes } from "../../presentation/routes/calendar.routes";
import { createEventRoutes, createCalendarEventRoutes } from "../../presentation/routes/event.routes";
import { createReminderRoutes, createEventReminderRoutes } from "../../presentation/routes/reminder.routes";
import { createContactRoutes } from "../../presentation/routes/contact.routes";
import { createSSERoutes } from "../../presentation/routes/sse.routes";
import { createEmailRoutes, createEmailAccountRoutes } from "../../presentation/routes/email.routes";
import { createConnectorConfigRoutes } from "../../presentation/routes/connector-config.routes";
import { createLlmRoutes } from "../../presentation/routes/llm.routes";

// --- Test Database (in-memory) ---
const sqlite = new Database(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON;");
const db = drizzle(sqlite, { schema });

// --- DI ---
const calendarRepo = new DrizzleCalendarRepository(db);
const eventRepo = new DrizzleEventRepository(db);
const reminderRepo = new DrizzleReminderRepository(db);
const contactRepo = new DrizzleContactRepository(db);
const emailAccountRepo = new DrizzleEmailAccountRepository(db);
const emailRepo = new DrizzleEmailRepository(db);
const connectorConfigRepo = new DrizzleConnectorConfigRepository(db);
const llmConfigRepo = new DrizzleLlmConfigRepository(db);

const calendarService = new CalendarService(calendarRepo);
const eventService = new EventService(eventRepo, reminderRepo);
const reminderService = new ReminderService(reminderRepo, eventRepo);
const contactService = new ContactService(contactRepo);
const reminderEmitter = new InMemoryReminderEmitter();

const noopImap = { syncInbox: async () => [], watchInbox: async () => {} } as any;
const noopSmtp = { sendEmail: async () => {} } as any;
const emailService = new EmailService(emailAccountRepo, emailRepo, noopImap, noopSmtp);
const connectorConfigService = new ConnectorConfigService(connectorConfigRepo);
const llmService = new LlmService(llmConfigRepo);

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
app.route("/api/emails", createEmailRoutes(emailService, llmService));
app.route("/api/email-accounts", createEmailAccountRoutes(emailService));
app.route("/api/connector-configs", createConnectorConfigRoutes(connectorConfigService));
app.route("/api/llm", createLlmRoutes(llmService));

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
  db.run(sql`DELETE FROM reminders`);
  db.run(sql`DELETE FROM events`);
  db.run(sql`DELETE FROM calendars`);
  db.run(sql`DELETE FROM contacts`);
  db.run(sql`DELETE FROM emails`);
  db.run(sql`DELETE FROM email_accounts`);
  db.run(sql`DELETE FROM connector_configs`);
  db.run(sql`DELETE FROM llm_configs`);
}

export async function closeDb() {
  // no-op — in-memory DB is cleaned up when the process exits
}
