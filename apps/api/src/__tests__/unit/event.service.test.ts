import { describe, it, expect, beforeEach, mock } from "bun:test";
import { EventService } from "../../application/event/event.service";
import type { EventRepository } from "../../domain/event/event.repository";
import type { ReminderRepository } from "../../domain/reminder/reminder.repository";
import type { CalendarEvent } from "../../domain/event/event.entity";

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
  taskId: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("EventService", () => {
  let service: EventService;
  let mockEventRepo: Record<keyof EventRepository, ReturnType<typeof mock>>;
  let mockReminderRepo: Record<keyof ReminderRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockEventRepo = {
      findAll: mock(() => Promise.resolve([])),
      findByCalendarId: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findByTaskId: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeEvent())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
      countByDateRange: mock(() => Promise.resolve({ total: 0, dailyStats: [] })),
    };
    mockReminderRepo = {
      findByEventId: mock(() => Promise.resolve([])),
      findPending: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve({} as any)),
      delete: mock(() => Promise.resolve(false)),
      deleteByEventId: mock(() => Promise.resolve()),
      markAsSent: mock(() => Promise.resolve()),
      updateScheduledAt: mock(() => Promise.resolve()),
    };
    service = new EventService(
      mockEventRepo as unknown as EventRepository,
      mockReminderRepo as unknown as ReminderRepository,
    );
  });

  describe("getAll", () => {
    it("should pass filters to the repository", async () => {
      const filters = {
        from: new Date("2026-03-01"),
        to: new Date("2026-03-31"),
        calendarId: "cal-1",
      };
      const events = [makeEvent()];
      mockEventRepo.findAll.mockReturnValue(Promise.resolve(events));

      const result = await service.getAll(filters);

      expect(result).toEqual(events);
      expect(mockEventRepo.findAll).toHaveBeenCalledWith(filters);
    });

    it("should return empty array when no events match", async () => {
      const result = await service.getAll({});

      expect(result).toEqual([]);
    });
  });

  describe("create", () => {
    it("should create an event without reminders", async () => {
      const input = {
        calendarId: "cal-1",
        title: "Meeting",
        startAt: new Date("2026-03-15T10:00:00Z"),
        endAt: new Date("2026-03-15T11:00:00Z"),
      };
      const created = makeEvent(input);
      mockEventRepo.create.mockReturnValue(Promise.resolve(created));

      const result = await service.create(input);

      expect(result).toEqual(created);
      expect(mockReminderRepo.create).not.toHaveBeenCalled();
    });

    it("should create an event with reminders and compute scheduledAt", async () => {
      const startAt = new Date("2026-03-15T10:00:00Z");
      const input = {
        calendarId: "cal-1",
        title: "Meeting",
        startAt,
        endAt: new Date("2026-03-15T11:00:00Z"),
      };
      const reminders = [{ minutesBefore: 15 }, { minutesBefore: 60 }];
      const created = makeEvent({ ...input, id: "evt-new" });
      mockEventRepo.create.mockReturnValue(Promise.resolve(created));

      await service.create(input, reminders);

      expect(mockReminderRepo.create).toHaveBeenCalledTimes(2);
      expect(mockReminderRepo.create).toHaveBeenCalledWith({
        eventId: "evt-new",
        minutesBefore: 15,
        scheduledAt: new Date(startAt.getTime() - 15 * 60_000),
      });
      expect(mockReminderRepo.create).toHaveBeenCalledWith({
        eventId: "evt-new",
        minutesBefore: 60,
        scheduledAt: new Date(startAt.getTime() - 60 * 60_000),
      });
    });

    it("should not create reminders when reminders array is empty", async () => {
      mockEventRepo.create.mockReturnValue(Promise.resolve(makeEvent()));

      await service.create(
        { calendarId: "cal-1", title: "Test", startAt: new Date(), endAt: new Date() },
        [],
      );

      expect(mockReminderRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update event and call updateScheduledAt when startAt changes", async () => {
      const newStartAt = new Date("2026-03-16T14:00:00Z");
      const updated = makeEvent({ startAt: newStartAt });
      mockEventRepo.update.mockReturnValue(Promise.resolve(updated));

      const result = await service.update("evt-1", { startAt: newStartAt });

      expect(result).toEqual(updated);
      expect(mockReminderRepo.updateScheduledAt).toHaveBeenCalledWith("evt-1", newStartAt);
    });

    it("should not call updateScheduledAt when startAt is not in the update", async () => {
      const updated = makeEvent({ title: "Renamed" });
      mockEventRepo.update.mockReturnValue(Promise.resolve(updated));

      await service.update("evt-1", { title: "Renamed" });

      expect(mockReminderRepo.updateScheduledAt).not.toHaveBeenCalled();
    });

    it("should return null when event to update is not found", async () => {
      const result = await service.update("nonexistent", { title: "Renamed" });

      expect(result).toBeNull();
      expect(mockReminderRepo.updateScheduledAt).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should delete the event via repository", async () => {
      mockEventRepo.delete.mockReturnValue(Promise.resolve(true));

      const result = await service.delete("evt-1");

      expect(result).toBe(true);
      expect(mockEventRepo.delete).toHaveBeenCalledWith("evt-1");
    });

    it("should return false when event to delete is not found", async () => {
      const result = await service.delete("nonexistent");

      expect(result).toBe(false);
    });
  });
});
