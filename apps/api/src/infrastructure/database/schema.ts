import { pgTable, uuid, varchar, text, boolean, timestamp, integer, numeric, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const calendars = pgTable("calendars", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).notNull().default("#6c5ce7"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: varchar("external_id", { length: 255 }),
  source: varchar("source", { length: 50 }).notNull().default("manual"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 255 }).notNull().default("open"),
  priority: varchar("priority", { length: 50 }),
  url: varchar("url", { length: 1000 }),
  labels: text("labels").notNull().default("[]"),
  assignees: text("assignees").notNull().default("[]"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  startDate: timestamp("start_date", { withTimezone: true }),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("idx_tasks_external_source").on(table.externalId, table.source),
]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  calendarId: uuid("calendar_id").notNull().references(() => calendars.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 500 }),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  isAllDay: boolean("is_all_day").notNull().default(false),
  recurrenceRule: varchar("recurrence_rule", { length: 500 }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const reminderTypeEnum = pgEnum("reminder_type", ["push"]);

export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  type: reminderTypeEnum("type").notNull().default("push"),
  minutesBefore: integer("minutes_before").notNull().default(15),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_reminders_pending").on(table.scheduledAt).where(sql`sent_at IS NULL`),
]);

export const timerSessions = pgTable("timer_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  mode: varchar("mode", { length: 20 }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  actualSeconds: integer("actual_seconds").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  completed: boolean("completed").notNull().default(true),
  label: varchar("label", { length: 255 }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wellnessConfigs = pgTable("wellness_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 50 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  intervalMinutes: integer("interval_minutes").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const wellnessLogs = pgTable("wellness_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 50 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  value: integer("value").notNull().default(0),
  goal: integer("goal").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const dogWalks = pgTable("dog_walks", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskTriage = pgTable("task_triage", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().unique().references(() => tasks.id, { onDelete: "cascade" }),
  triageStatus: varchar("triage_status", { length: 50 }).notNull(),
  triagedAt: timestamp("triaged_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const emailAccounts = pgTable("email_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: varchar("label", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  imapHost: varchar("imap_host", { length: 255 }).notNull(),
  imapPort: integer("imap_port").notNull().default(993),
  imapSecure: boolean("imap_secure").notNull().default(true),
  smtpHost: varchar("smtp_host", { length: 255 }).notNull(),
  smtpPort: integer("smtp_port").notNull().default(587),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
  username: varchar("username", { length: 255 }).notNull(),
  passwordEnc: text("password_enc").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const emails = pgTable("emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),
  messageId: varchar("message_id", { length: 500 }).notNull(),
  imapUid: integer("imap_uid"),
  subject: varchar("subject", { length: 1000 }),
  fromAddress: varchar("from_address", { length: 500 }).notNull(),
  fromName: varchar("from_name", { length: 255 }),
  toAddresses: text("to_addresses").notNull().default("[]"),
  ccAddresses: text("cc_addresses"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  hasAttachments: boolean("has_attachments").notNull().default(false),
  attachmentNames: text("attachment_names"),
  isRead: boolean("is_read").notNull().default(false),
  isStarred: boolean("is_starred").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  folder: varchar("folder", { length: 255 }).notNull().default("INBOX"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_emails_account_folder").on(table.accountId, table.folder, table.sentAt),
  index("idx_emails_unread").on(table.accountId, table.isRead),
]);

export const llmConfigs = pgTable("llm_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: varchar("provider", { length: 50 }).notNull(),
  baseUrl: varchar("base_url", { length: 500 }).notNull(),
  model: varchar("model", { length: 255 }).notNull(),
  apiKey: text("api_key"),
  maxTokens: integer("max_tokens").notNull().default(2048),
  temperature: varchar("temperature", { length: 10 }).notNull().default("0.7"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const chatConversations = pgTable("chat_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull().default("Nouvelle conversation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_chat_messages_conversation").on(table.conversationId, table.createdAt),
]);

export const githubConfig = pgTable("github_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  repos: text("repos").notNull().default("[]"),
  pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(300),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const githubPrs = pgTable("github_prs", {
  id: uuid("id").primaryKey().defaultRandom(),
  prNumber: integer("pr_number").notNull(),
  repo: varchar("repo", { length: 500 }).notNull(),
  title: varchar("title", { length: 1000 }).notNull(),
  state: varchar("state", { length: 50 }).notNull(),
  draft: boolean("draft").notNull().default(false),
  author: varchar("author", { length: 255 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  reviewRequested: boolean("review_requested").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("idx_github_prs_repo_number").on(table.repo, table.prNumber),
]);

export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  emoji: varchar("emoji", { length: 10 }),
  isFavorite: boolean("is_favorite").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#6c5ce7"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  birthDate: timestamp("birth_date", { withTimezone: true }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
