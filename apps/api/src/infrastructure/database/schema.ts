import { pgTable, uuid, varchar, text, boolean, timestamp, integer, pgEnum, index } from "drizzle-orm/pg-core";
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
  clickupTaskId: varchar("clickup_task_id", { length: 255 }).unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const clickupUnscheduledTasks = pgTable("clickup_unscheduled_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  clickupTaskId: varchar("clickup_task_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 255 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  listName: varchar("list_name", { length: 255 }).notNull(),
  priority: varchar("priority", { length: 50 }),
  assignees: text("assignees").notNull().default("[]"),
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
