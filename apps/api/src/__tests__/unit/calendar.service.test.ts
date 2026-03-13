import { describe, it, expect, beforeEach, mock } from "bun:test";
import { CalendarService } from "../../application/calendar/calendar.service";
import type { CalendarRepository } from "../../domain/calendar/calendar.repository";
import type { Calendar } from "../../domain/calendar/calendar.entity";

const makeCalendar = (overrides: Partial<Calendar> = {}): Calendar => ({
  id: "cal-1",
  name: "Work",
  description: null,
  color: "#3B82F6",
  isDefault: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("CalendarService", () => {
  let service: CalendarService;
  let mockRepo: Record<keyof CalendarRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeCalendar())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
    };
    service = new CalendarService(mockRepo as unknown as CalendarRepository);
  });

  describe("getAll", () => {
    it("should return all calendars from the repository", async () => {
      const calendars = [makeCalendar(), makeCalendar({ id: "cal-2", name: "Personal" })];
      mockRepo.findAll.mockReturnValue(Promise.resolve(calendars));

      const result = await service.getAll();

      expect(result).toEqual(calendars);
      expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when no calendars exist", async () => {
      const result = await service.getAll();

      expect(result).toEqual([]);
    });
  });

  describe("getById", () => {
    it("should return a calendar when found", async () => {
      const calendar = makeCalendar();
      mockRepo.findById.mockReturnValue(Promise.resolve(calendar));

      const result = await service.getById("cal-1");

      expect(result).toEqual(calendar);
      expect(mockRepo.findById).toHaveBeenCalledWith("cal-1");
    });

    it("should return null when calendar not found", async () => {
      const result = await service.getById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should create a calendar with the given input", async () => {
      const input = { name: "Work", color: "#3B82F6" };
      const created = makeCalendar(input);
      mockRepo.create.mockReturnValue(Promise.resolve(created));

      const result = await service.create(input);

      expect(result).toEqual(created);
      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });
  });

  describe("update", () => {
    it("should update a calendar and return it", async () => {
      const updated = makeCalendar({ name: "Updated" });
      mockRepo.update.mockReturnValue(Promise.resolve(updated));

      const result = await service.update("cal-1", { name: "Updated" });

      expect(result).toEqual(updated);
      expect(mockRepo.update).toHaveBeenCalledWith("cal-1", { name: "Updated" });
    });

    it("should return null when calendar to update is not found", async () => {
      const result = await service.update("nonexistent", { name: "Updated" });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("should return true when calendar is deleted", async () => {
      mockRepo.delete.mockReturnValue(Promise.resolve(true));

      const result = await service.delete("cal-1");

      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith("cal-1");
    });

    it("should return false when calendar to delete is not found", async () => {
      const result = await service.delete("nonexistent");

      expect(result).toBe(false);
    });
  });
});
