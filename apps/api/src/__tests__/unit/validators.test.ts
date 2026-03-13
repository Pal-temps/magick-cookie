import { describe, it, expect } from "bun:test";
import { createCalendarSchema, updateCalendarSchema } from "../../presentation/validators/calendar.validator";
import { createEventSchema, updateEventSchema, eventQuerySchema } from "../../presentation/validators/event.validator";
import { createReminderSchema } from "../../presentation/validators/reminder.validator";

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
        isAllDay: false,
        recurrenceRule: "FREQ=WEEKLY",
        reminders: [],
      });
      expect(result.success).toBe(true);
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
