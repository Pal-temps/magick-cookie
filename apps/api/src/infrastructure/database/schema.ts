import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const calendars = sqliteTable("calendars", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6c5ce7"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  externalId: text("external_id"),
  source: text("source").notNull().default("manual"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  priority: text("priority"),
  url: text("url"),
  labels: text("labels").notNull().default("[]"),
  assignees: text("assignees").notNull().default("[]"),
  dueDate: integer("due_date", { mode: "timestamp" }),
  startDate: integer("start_date", { mode: "timestamp" }),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("idx_tasks_external_source").on(table.externalId, table.source),
  index("idx_tasks_source").on(table.source),
  index("idx_tasks_due_date").on(table.dueDate),
]);

export const events = sqliteTable("events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  calendarId: text("calendar_id").notNull().references(() => calendars.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  startAt: integer("start_at", { mode: "timestamp" }).notNull(),
  endAt: integer("end_at", { mode: "timestamp" }).notNull(),
  isAllDay: integer("is_all_day", { mode: "boolean" }).notNull().default(false),
  recurrenceRule: text("recurrence_rule"),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("push"),
  minutesBefore: integer("minutes_before").notNull().default(15),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull(),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (table) => [
  index("idx_reminders_pending").on(table.scheduledAt).where(sql`sent_at IS NULL`),
]);

export const timerSessions = sqliteTable("timer_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  mode: text("mode").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  actualSeconds: integer("actual_seconds").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }).notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(true),
  label: text("label"),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const wellnessConfigs = sqliteTable("wellness_configs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull().unique(),
  label: text("label").notNull(),
  intervalMinutes: integer("interval_minutes").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  alertSound: text("alert_sound"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const wellnessLogs = sqliteTable("wellness_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  date: text("date").notNull(),
  value: integer("value").notNull().default(0),
  goal: integer("goal").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const dogWalks = sqliteTable("dog_walks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  durationSeconds: integer("duration_seconds"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const fluxItems = sqliteTable("flux_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  fluxStatus: text("flux_status").notNull(),
  decidedAt: integer("decided_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("idx_flux_entity").on(table.entityType, table.entityId),
  index("idx_flux_status").on(table.fluxStatus),
  index("idx_flux_type_status").on(table.entityType, table.fluxStatus),
  index("idx_flux_pagination").on(table.entityType, table.fluxStatus, table.decidedAt),
]);

export const emailAccounts = sqliteTable("email_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  label: text("label").notNull(),
  email: text("email").notNull(),
  imapHost: text("imap_host").notNull(),
  imapPort: integer("imap_port").notNull().default(993),
  imapSecure: integer("imap_secure", { mode: "boolean" }).notNull().default(true),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull().default(587),
  smtpSecure: integer("smtp_secure", { mode: "boolean" }).notNull().default(false),
  username: text("username").notNull(),
  passwordEnc: text("password_enc").notNull(),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  selfSigned: integer("self_signed", { mode: "boolean" }).notNull().default(false),
  syncEnabled: integer("sync_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const emails = sqliteTable("emails", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull(),
  imapUid: integer("imap_uid"),
  subject: text("subject"),
  fromAddress: text("from_address").notNull(),
  fromName: text("from_name"),
  toAddresses: text("to_addresses").notNull().default("[]"),
  ccAddresses: text("cc_addresses"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  hasAttachments: integer("has_attachments", { mode: "boolean" }).notNull().default(false),
  attachmentNames: text("attachment_names"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  isStarred: integer("is_starred", { mode: "boolean" }).notNull().default(false),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  folder: text("folder").notNull().default("INBOX"),
  summary: text("summary"),
  classification: text("classification"),
  sentAt: integer("sent_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (table) => [
  index("idx_emails_account_folder").on(table.accountId, table.folder, table.sentAt),
  index("idx_emails_unread").on(table.accountId, table.isRead),
]);

export const llmConfigs = sqliteTable("llm_configs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider: text("provider").notNull(),
  baseUrl: text("base_url").notNull(),
  model: text("model").notNull(),
  apiKey: text("api_key"),
  maxTokens: integer("max_tokens").notNull().default(2048),
  temperature: text("temperature").notNull().default("0.7"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const chatConversations = sqliteTable("chat_conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull().default("Nouvelle conversation"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (table) => [
  index("idx_chat_messages_conversation").on(table.conversationId, table.createdAt),
]);

export const syncedIssues = sqliteTable("synced_issues", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  source: text("source").notNull().default("github"),
  externalId: text("external_id").notNull(),
  prNumber: integer("pr_number").notNull(),
  repo: text("repo").notNull(),
  title: text("title").notNull(),
  state: text("state").notNull(),
  draft: integer("draft", { mode: "boolean" }).notNull().default(false),
  author: text("author").notNull(),
  url: text("url").notNull(),
  reviewRequested: integer("review_requested", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("idx_synced_issues_source_external_id").on(table.source, table.externalId),
]);

export const bookmarkCategories = sqliteTable("bookmark_categories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  value: text("value").notNull().unique(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  url: text("url").notNull(),
  emoji: text("emoji"),
  category: text("category").notNull().default("none"),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6c5ce7"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const pushNotifications = sqliteTable("push_notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  readAt: integer("read_at", { mode: "timestamp" }),
});

export const agentMemory = sqliteTable("agent_memory", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
}, (table) => [
  index("idx_agent_memory_type").on(table.type),
]);

export const alarms = sqliteTable("alarms", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  time: text("time").notNull(),
  label: text("label").notNull(),
  repeatPattern: text("repeat_pattern").notNull().default("once"),
  repeatDays: text("repeat_days"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  alertSound: text("alert_sound").default("alarm"),
  lastFiredAt: integer("last_fired_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const rssFeeds = sqliteTable("rss_feeds", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  label: text("label").notNull(),
  url: text("url").notNull(),
  category: text("category"),
  siteUrl: text("site_url"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  syncEnabled: integer("sync_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const rssArticles = sqliteTable("rss_articles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  feedId: text("feed_id").notNull().references(() => rssFeeds.id, { onDelete: "cascade" }),
  guid: text("guid").notNull(),
  title: text("title"),
  link: text("link"),
  description: text("description"),
  content: text("content"),
  author: text("author"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  isStarred: integer("is_starred", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (table) => [
  index("idx_rss_articles_feed_published").on(table.feedId, table.publishedAt),
  index("idx_rss_articles_unread").on(table.feedId, table.isRead),
  uniqueIndex("idx_rss_articles_feed_guid").on(table.feedId, table.guid),
]);

export const snippets = sqliteTable("snippets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  content: text("content").notNull(),
  language: text("language").notNull().default("text"),
  tags: text("tags").notNull().default("[]"),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const caldavAccounts = sqliteTable("caldav_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  label: text("label").notNull(),
  url: text("url").notNull(),
  username: text("username").notNull(),
  passwordEnc: text("password_enc").notNull(),
  calendarId: text("calendar_id").references(() => calendars.id, { onDelete: "set null" }),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  syncEnabled: integer("sync_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const emailRules = sqliteTable("email_rules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  conditionField: text("condition_field").notNull(),
  conditionOperator: text("condition_operator").notNull(),
  conditionValue: text("condition_value").notNull(),
  actionType: text("action_type").notNull(),
  actionValue: text("action_value").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const routines = sqliteTable("routines", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  triggerTime: text("trigger_time").notNull(),
  triggerDays: text("trigger_days").notNull().default("1,2,3,4,5"),
  steps: text("steps").notNull().default("[]"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const webhooks = sqliteTable("webhooks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  secret: text("secret").notNull(),
  source: text("source"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  webhookId: text("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
  payload: text("payload").notNull(),
  receivedAt: integer("received_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  readAt: integer("read_at", { mode: "timestamp" }),
}, (table) => [
  index("idx_webhook_events_webhook").on(table.webhookId, table.receivedAt),
]);

export const userPreferences = sqliteTable("user_preferences", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  data: text("data").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const connectorConfigs = sqliteTable("connector_configs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull().unique(),
  token: text("token").notNull(),
  settings: text("settings").notNull().default("{}"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});

export const aiToolCalls = sqliteTable("ai_tool_calls", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id"),
  sessionId: text("session_id"),
  toolName: text("tool_name").notNull(),
  permissionLevel: text("permission_level").notNull().default("auto"),
  args: text("args").notNull().default("{}"),
  result: text("result"),
  errorMessage: text("error_message"),
  status: text("status").notNull(),
  durationMs: integer("duration_ms"),
  undoToken: text("undo_token"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (table) => [
  index("idx_ai_tool_calls_conversation").on(table.conversationId, table.createdAt),
  index("idx_ai_tool_calls_tool").on(table.toolName, table.createdAt),
]);

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  birthDate: integer("birth_date", { mode: "timestamp" }),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date()),
});
