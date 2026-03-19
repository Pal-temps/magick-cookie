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
  alertSound: varchar("alert_sound", { length: 50 }),
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
  summary: text("summary"),
  classification: varchar("classification", { length: 50 }),
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

export const bookmarkCategories = pgTable("bookmark_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  value: varchar("value", { length: 30 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookmarkTags = pgTable("bookmark_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  value: varchar("value", { length: 30 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  emoji: varchar("emoji", { length: 10 }),
  tag: varchar("tag", { length: 30 }).notNull().default("none"),
  category: varchar("category", { length: 30 }).notNull().default("none"),
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

export const pushNotifications = pgTable("push_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

export const agentMemory = pgTable("agent_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 20 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => [
  index("idx_agent_memory_type").on(table.type),
]);

export const alarms = pgTable("alarms", {
  id: uuid("id").primaryKey().defaultRandom(),
  time: varchar("time", { length: 5 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  repeatPattern: varchar("repeat_pattern", { length: 20 }).notNull().default("once"),
  repeatDays: varchar("repeat_days", { length: 20 }),
  enabled: boolean("enabled").notNull().default(true),
  lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const rssFeeds = pgTable("rss_feeds", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: varchar("label", { length: 255 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  category: varchar("category", { length: 100 }),
  siteUrl: varchar("site_url", { length: 1000 }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const rssArticles = pgTable("rss_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedId: uuid("feed_id").notNull().references(() => rssFeeds.id, { onDelete: "cascade" }),
  guid: varchar("guid", { length: 1000 }).notNull(),
  title: varchar("title", { length: 1000 }),
  link: varchar("link", { length: 1000 }),
  description: text("description"),
  content: text("content"),
  author: varchar("author", { length: 500 }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  isRead: boolean("is_read").notNull().default(false),
  isStarred: boolean("is_starred").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_rss_articles_feed_published").on(table.feedId, table.publishedAt),
  index("idx_rss_articles_unread").on(table.feedId, table.isRead),
  uniqueIndex("idx_rss_articles_feed_guid").on(table.feedId, table.guid),
]);

export const snippetCategories = pgTable("snippet_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  value: varchar("value", { length: 30 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const snippets = pgTable("snippets", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  language: varchar("language", { length: 50 }).notNull().default("text"),
  category: varchar("category", { length: 30 }).notNull().default("none"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const caldavAccounts = pgTable("caldav_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: varchar("label", { length: 255 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  passwordEnc: text("password_enc").notNull(),
  calendarId: uuid("calendar_id").references(() => calendars.id, { onDelete: "set null" }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const emailRules = pgTable("email_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  conditionField: varchar("condition_field", { length: 50 }).notNull(),
  conditionOperator: varchar("condition_operator", { length: 20 }).notNull(),
  conditionValue: varchar("condition_value", { length: 500 }).notNull(),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  actionValue: varchar("action_value", { length: 100 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const routines = pgTable("routines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  triggerTime: varchar("trigger_time", { length: 5 }).notNull(),
  triggerDays: varchar("trigger_days", { length: 20 }).notNull().default("1,2,3,4,5"),
  steps: text("steps").notNull().default("[]"),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  secret: varchar("secret", { length: 255 }).notNull(),
  source: varchar("source", { length: 100 }),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookId: uuid("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
  payload: text("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
}, (table) => [
  index("idx_webhook_events_webhook").on(table.webhookId, table.receivedAt),
]);

export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  data: text("data").notNull(),
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
