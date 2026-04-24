import { describe, it, expect } from "bun:test";
import { createCalendarSchema, updateCalendarSchema } from "../../presentation/validators/calendar.validator";
import { createEventSchema, updateEventSchema, eventQuerySchema } from "../../presentation/validators/event.validator";
import { createReminderSchema } from "../../presentation/validators/reminder.validator";
import { createAlarmSchema, updateAlarmSchema } from "../../presentation/validators/alarm.validator";
import { createBookmarkSchema, updateBookmarkSchema, createBookmarkCategorySchema, updateBookmarkCategorySchema } from "../../presentation/validators/bookmark.validator";
import { createSnippetSchema, updateSnippetSchema } from "../../presentation/validators/snippet.validator";

describe("Calendar validators", () => {
  describe("createCalendarSchema", () => {
    it("should accept a valid calendar with name only", () => {
      const result = createCalendarSchema.safeParse({ name: "Work" });
      expect(result.success).toBe(true);
    });

    it("should accept a valid calendar with all fields", () => {
      const result = createCalendarSchema.safeParse({
        name: "Work",
        description: "Work calendar",
        color: "#3B82F6",
        isDefault: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty name", () => {
      const result = createCalendarSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });

    it("should reject missing name", () => {
      const result = createCalendarSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject invalid color format (no hash)", () => {
      const result = createCalendarSchema.safeParse({ name: "Work", color: "3B82F6" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid color format (too short)", () => {
      const result = createCalendarSchema.safeParse({ name: "Work", color: "#3B8" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid color format (non-hex chars)", () => {
      const result = createCalendarSchema.safeParse({ name: "Work", color: "#ZZZZZZ" });
      expect(result.success).toBe(false);
    });

    it("should accept null description", () => {
      const result = createCalendarSchema.safeParse({ name: "Work", description: null });
      expect(result.success).toBe(true);
    });
  });

  describe("updateCalendarSchema", () => {
    it("should accept partial update with name only", () => {
      const result = updateCalendarSchema.safeParse({ name: "Updated" });
      expect(result.success).toBe(true);
    });

    it("should accept empty object (no fields to update)", () => {
      const result = updateCalendarSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject empty name string", () => {
      const result = updateCalendarSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid color in update", () => {
      const result = updateCalendarSchema.safeParse({ color: "red" });
      expect(result.success).toBe(false);
    });
  });
});

describe("Event validators", () => {
  const validEvent = {
    title: "Meeting",
    startAt: "2026-03-15T10:00:00Z",
    endAt: "2026-03-15T11:00:00Z",
  };

  describe("createEventSchema", () => {
    it("should accept a valid event with required fields", () => {
      const result = createEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it("should coerce date strings to Date objects", () => {
      const result = createEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startAt).toBeInstanceOf(Date);
        expect(result.data.endAt).toBeInstanceOf(Date);
      }
    });

    it("should accept event with reminders array", () => {
      const result = createEventSchema.safeParse({
        ...validEvent,
        reminders: [{ minutesBefore: 15 }, { minutesBefore: 60 }],
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing title", () => {
      const result = createEventSchema.safeParse({
        startAt: "2026-03-15T10:00:00Z",
        endAt: "2026-03-15T11:00:00Z",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing startAt", () => {
      const result = createEventSchema.safeParse({
        title: "Meeting",
        endAt: "2026-03-15T11:00:00Z",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing endAt", () => {
      const result = createEventSchema.safeParse({
        title: "Meeting",
        startAt: "2026-03-15T10:00:00Z",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid date format", () => {
      const result = createEventSchema.safeParse({
        title: "Meeting",
        startAt: "not-a-date",
        endAt: "2026-03-15T11:00:00Z",
      });
      expect(result.success).toBe(false);
    });

    it("should accept event with all optional fields", () => {
      const result = createEventSchema.safeParse({
        ...validEvent,
        description: "A meeting",
        location: "Room 42",
        latitude: 48.8566,
        longitude: 2.3522,
        isAllDay: false,
        recurrenceRule: "FREQ=WEEKLY",
        reminders: [],
      });
      expect(result.success).toBe(true);
    });

    it("should accept null latitude and longitude", () => {
      const result = createEventSchema.safeParse({
        ...validEvent,
        latitude: null,
        longitude: null,
      });
      expect(result.success).toBe(true);
    });

    it("should reject non-number latitude", () => {
      const result = createEventSchema.safeParse({
        ...validEvent,
        latitude: "not-a-number",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateEventSchema", () => {
    it("should accept partial update", () => {
      const result = updateEventSchema.safeParse({ title: "Updated" });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = updateEventSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject empty title", () => {
      const result = updateEventSchema.safeParse({ title: "" });
      expect(result.success).toBe(false);
    });

    it("should accept coordinates in update", () => {
      const result = updateEventSchema.safeParse({
        latitude: 48.8566,
        longitude: 2.3522,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("eventQuerySchema", () => {
    it("should accept valid query with from and to", () => {
      const result = eventQuerySchema.safeParse({
        from: "2026-03-01T00:00:00Z",
        to: "2026-03-31T23:59:59Z",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.from).toBeInstanceOf(Date);
        expect(result.data.to).toBeInstanceOf(Date);
      }
    });

    it("should accept valid query with calendarId", () => {
      const result = eventQuerySchema.safeParse({
        calendarId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = eventQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject non-uuid calendarId", () => {
      const result = eventQuerySchema.safeParse({ calendarId: "not-a-uuid" });
      expect(result.success).toBe(false);
    });
  });
});

describe("Reminder validators", () => {
  describe("createReminderSchema", () => {
    it("should accept valid minutesBefore", () => {
      const result = createReminderSchema.safeParse({ minutesBefore: 30 });
      expect(result.success).toBe(true);
    });

    it("should accept zero minutesBefore", () => {
      const result = createReminderSchema.safeParse({ minutesBefore: 0 });
      expect(result.success).toBe(true);
    });

    it("should use default of 15 when minutesBefore is not provided", () => {
      const result = createReminderSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minutesBefore).toBe(15);
      }
    });

    it("should reject negative minutesBefore", () => {
      const result = createReminderSchema.safeParse({ minutesBefore: -5 });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer minutesBefore", () => {
      const result = createReminderSchema.safeParse({ minutesBefore: 15.5 });
      expect(result.success).toBe(false);
    });
  });
});

describe("Alarm validators", () => {
  const validAlarm = { time: "07:30", label: "Wake up" };

  describe("createAlarmSchema", () => {
    it("should accept valid alarm with time and label", () => {
      const result = createAlarmSchema.safeParse(validAlarm);
      expect(result.success).toBe(true);
    });

    it("should accept all optional fields including alertSound", () => {
      const result = createAlarmSchema.safeParse({
        ...validAlarm,
        repeatPattern: "weekdays",
        repeatDays: [1, 2, 3, 4, 5],
        enabled: true,
        alertSound: "chime.mp3",
      });
      expect(result.success).toBe(true);
    });

    it("should accept time with any two-digit hour (regex only checks format)", () => {
      const result = createAlarmSchema.safeParse({ time: "25:00", label: "Edge" });
      expect(result.success).toBe(true);
    });

    it("should reject non-digit time format (abc)", () => {
      const result = createAlarmSchema.safeParse({ time: "abc", label: "Bad" });
      expect(result.success).toBe(false);
    });

    it("should reject time with single-digit hour (8:00)", () => {
      const result = createAlarmSchema.safeParse({ time: "8:00", label: "Bad" });
      expect(result.success).toBe(false);
    });

    it("should reject empty label", () => {
      const result = createAlarmSchema.safeParse({ time: "08:00", label: "" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid repeatPattern", () => {
      const result = createAlarmSchema.safeParse({ ...validAlarm, repeatPattern: "monthly" });
      expect(result.success).toBe(false);
    });

    it("should accept null repeatDays", () => {
      const result = createAlarmSchema.safeParse({ ...validAlarm, repeatDays: null });
      expect(result.success).toBe(true);
    });

    it("should reject alertSound over 50 chars", () => {
      const result = createAlarmSchema.safeParse({
        ...validAlarm,
        alertSound: "a".repeat(51),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateAlarmSchema", () => {
    it("should accept partial update with time only", () => {
      const result = updateAlarmSchema.safeParse({ time: "09:00" });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = updateAlarmSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject empty label in update", () => {
      const result = updateAlarmSchema.safeParse({ label: "" });
      expect(result.success).toBe(false);
    });

    it("should reject malformed time in update (no colon)", () => {
      const result = updateAlarmSchema.safeParse({ time: "0930" });
      expect(result.success).toBe(false);
    });
  });
});

describe("Bookmark validators", () => {
  const validBookmark = { name: "GitHub", url: "https://github.com" };

  describe("createBookmarkSchema", () => {
    it("should accept valid bookmark with name and URL", () => {
      const result = createBookmarkSchema.safeParse(validBookmark);
      expect(result.success).toBe(true);
    });

    it("should accept valid http URL", () => {
      const result = createBookmarkSchema.safeParse({ name: "Local", url: "http://localhost:3000" });
      expect(result.success).toBe(true);
    });

    it("should reject empty name", () => {
      const result = createBookmarkSchema.safeParse({ name: "", url: "https://example.com" });
      expect(result.success).toBe(false);
    });

    it("should reject javascript: URL scheme", () => {
      const result = createBookmarkSchema.safeParse({ name: "XSS", url: "javascript:alert(1)" });
      expect(result.success).toBe(false);
    });

    it("should reject data: URL scheme", () => {
      const result = createBookmarkSchema.safeParse({ name: "Data", url: "data:text/html,<h1>hi</h1>" });
      expect(result.success).toBe(false);
    });

    it("should accept category and sortOrder", () => {
      const result = createBookmarkSchema.safeParse({
        ...validBookmark,
        category: "dev",
        sortOrder: 5,
      });
      expect(result.success).toBe(true);
    });

    it("should strip HTML tags from name", () => {
      const result = createBookmarkSchema.safeParse({
        name: "<script>alert(1)</script>Clean",
        url: "https://example.com",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).not.toContain("<script>");
      }
    });
  });

  describe("updateBookmarkSchema", () => {
    it("should accept partial update with name only", () => {
      const result = updateBookmarkSchema.safeParse({ name: "Updated" });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = updateBookmarkSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject empty name in update", () => {
      const result = updateBookmarkSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });

    it("should reject javascript: URL in update", () => {
      const result = updateBookmarkSchema.safeParse({ url: "javascript:void(0)" });
      expect(result.success).toBe(false);
    });
  });

  describe("createBookmarkCategorySchema", () => {
    it("should accept valid category", () => {
      const result = createBookmarkCategorySchema.safeParse({ value: "dev", label: "Development" });
      expect(result.success).toBe(true);
    });

    it("should reject empty value", () => {
      const result = createBookmarkCategorySchema.safeParse({ value: "", label: "Dev" });
      expect(result.success).toBe(false);
    });

    it("should reject empty label", () => {
      const result = createBookmarkCategorySchema.safeParse({ value: "dev", label: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("updateBookmarkCategorySchema", () => {
    it("should accept partial update with label only", () => {
      const result = updateBookmarkCategorySchema.safeParse({ label: "Updated" });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = updateBookmarkCategorySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept sortOrder only", () => {
      const result = updateBookmarkCategorySchema.safeParse({ sortOrder: 3 });
      expect(result.success).toBe(true);
    });
  });
});

describe("Snippet validators", () => {
  const validSnippet = { title: "Hello World", content: "console.log('hello');" };

  describe("createSnippetSchema", () => {
    it("should accept valid snippet with title and content", () => {
      const result = createSnippetSchema.safeParse(validSnippet);
      expect(result.success).toBe(true);
    });

    it("should accept tags array", () => {
      const result = createSnippetSchema.safeParse({
        ...validSnippet,
        tags: ["javascript", "logging"],
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty title", () => {
      const result = createSnippetSchema.safeParse({ title: "", content: "code" });
      expect(result.success).toBe(false);
    });

    it("should reject missing content", () => {
      const result = createSnippetSchema.safeParse({ title: "Test" });
      expect(result.success).toBe(false);
    });

    it("should reject tag longer than 30 chars", () => {
      const result = createSnippetSchema.safeParse({
        ...validSnippet,
        tags: ["a".repeat(31)],
      });
      expect(result.success).toBe(false);
    });

    it("should accept all optional fields", () => {
      const result = createSnippetSchema.safeParse({
        ...validSnippet,
        language: "typescript",
        tags: ["ts"],
        isFavorite: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateSnippetSchema", () => {
    it("should accept partial update with title only", () => {
      const result = updateSnippetSchema.safeParse({ title: "Updated" });
      expect(result.success).toBe(true);
    });

    it("should accept partial update with tags", () => {
      const result = updateSnippetSchema.safeParse({ tags: ["new-tag"] });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = updateSnippetSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject empty title in update", () => {
      const result = updateSnippetSchema.safeParse({ title: "" });
      expect(result.success).toBe(false);
    });

    it("should reject tag longer than 30 chars in update", () => {
      const result = updateSnippetSchema.safeParse({ tags: ["a".repeat(31)] });
      expect(result.success).toBe(false);
    });
  });
});
