import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ReminderService } from "../../application/reminder/reminder.service";
import type { ReminderRepository } from "../../domain/reminder/reminder.repository";
import type { EventRepository } from "../../domain/event/event.repository";
import type { Reminder } from "../../domain/reminder/reminder.entity";
import type { CalendarEvent } from "../../domain/event/event.entity";

const makeReminder = (overrides: Partial<Reminder> = {}): Reminder => ({
  id: "rem-1",
  eventId: "evt-1",
  type: "push",
  minutesBefore: 15,
  scheduledAt: new Date("2026-03-15T09:45:00Z"),
  sentAt: null,
  createdAt: new Date("2026-01-01"),
  ...overrides,
});

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "evt-1",
  calendarId: "cal-1",
  title: "Meeting",
  description: null,
  location: null,
  startAt: new Date("2026-03-15T10:00:00Z"),
  endAt: new Date("2026-03-15T11:00:00Z"),
  isAllDay: false,
  recurrenceRule: null,
  clickupTaskId: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("ReminderService", () => {
  let service: ReminderService;
  let mockReminderRepo: Record<keyof ReminderRepository, ReturnType<typeof mock>>;
  let mockEventRepo: Record<keyof EventRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockReminderRepo = {
      findByEventId: mock(() => Promise.resolve([])),
      findPending: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve(makeReminder())),
      delete: mock(() => Promise.resolve(false)),
      deleteByEventId: mock(() => Promise.resolve()),
      markAsSent: mock(() => Promise.resolve()),
      updateScheduledAt: mock(() => Promise.resolve()),
    };
    mockEventRepo = {
      findAll: mock(() => Promise.resolve([])),
      findByCalendarId: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findByClickUpTaskId: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeEvent())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
    };
    service = new ReminderService(
      mockReminderRepo as unknown as ReminderRepository,
      mockEventRepo as unknown as EventRepository,
    );
  });

  describe("getPending", () => {
    it("should return pending reminders from repository", async () => {
      const pending = [makeReminder(), makeReminder({ id: "rem-2" })];
      mockReminderRepo.findPending.mockReturnValue(Promise.resolve(pending));

      const result = await service.getPending();

      expect(result).toEqual(pending);
      expect(mockReminderRepo.findPending).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when no pending reminders", async () => {
      const result = await service.getPending();

      expect(result).toEqual([]);
    });
  });

  describe("create", () => {
    it("should compute scheduledAt as event.startAt minus minutesBefore * 60000", async () => {
      const event = makeEvent({ startAt: new Date("2026-03-15T10:00:00Z") });
      mockEventRepo.findById.mockReturnValue(Promise.resolve(event));

      await service.create("evt-1", 30);

      const expectedScheduledAt = new Date("2026-03-15T09:30:00Z");
      expect(mockReminderRepo.create).toHaveBeenCalledWith({
        eventId: "evt-1",
        minutesBefore: 30,
        scheduledAt: expectedScheduledAt,
      });
    });

    it("should use default minutesBefore of 15 when not provided", async () => {
      const event = makeEvent({ startAt: new Date("2026-03-15T10:00:00Z") });
      mockEventRepo.findById.mockReturnValue(Promise.resolve(event));

      await service.create("evt-1");

      expect(mockReminderRepo.create).toHaveBeenCalledWith({
        eventId: "evt-1",
        minutesBefore: 15,
        scheduledAt: new Date("2026-03-15T09:45:00Z"),
      });
    });

    it("should throw when event does not exist", async () => {
      mockEventRepo.findById.mockReturnValue(Promise.resolve(null));

      expect(service.create("nonexistent", 15)).rejects.toThrow("Event not found");
      expect(mockReminderRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should delete the reminder via repository", async () => {
      mockReminderRepo.delete.mockReturnValue(Promise.resolve(true));

      const result = await service.delete("rem-1");

      expect(result).toBe(true);
      expect(mockReminderRepo.delete).toHaveBeenCalledWith("rem-1");
    });

    it("should return false when reminder not found", async () => {
      const result = await service.delete("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("markAsSent", () => {
    it("should call markAsSent on the repository", async () => {
      await service.markAsSent("rem-1");

      expect(mockReminderRepo.markAsSent).toHaveBeenCalledWith("rem-1");
      expect(mockReminderRepo.markAsSent).toHaveBeenCalledTimes(1);
    });
  });
});
