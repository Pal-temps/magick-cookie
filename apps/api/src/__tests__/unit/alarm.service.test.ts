import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AlarmService } from "../../application/alarm/alarm.service";
import type { AlarmRepository } from "../../domain/alarm/alarm.repository";
import type { Alarm } from "../../domain/alarm/alarm.entity";

const makeAlarm = (overrides: Partial<Alarm> = {}): Alarm => ({
  id: "a-1",
  time: "07:30",
  label: "Wake up",
  repeatPattern: "daily",
  repeatDays: null,
  enabled: true,
  alertSound: null,
  lastFiredAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("AlarmService", () => {
  let service: AlarmService;
  let mockRepo: Record<keyof AlarmRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findEnabled: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve(makeAlarm())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
      markFired: mock(() => Promise.resolve(undefined)),
    };
    service = new AlarmService(mockRepo as unknown as AlarmRepository);
  });

  // --- getAll ---
  it("getAll returns all alarms", async () => {
    const alarms = [makeAlarm(), makeAlarm({ id: "a-2", label: "Lunch" })];
    mockRepo.findAll.mockReturnValue(Promise.resolve(alarms));

    const result = await service.getAll();

    expect(result).toEqual(alarms);
    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it("getAll returns empty array when no alarms", async () => {
    const result = await service.getAll();
    expect(result).toEqual([]);
  });

  // --- getEnabled ---
  it("getEnabled returns only enabled alarms", async () => {
    const enabled = [makeAlarm(), makeAlarm({ id: "a-2" })];
    mockRepo.findEnabled.mockReturnValue(Promise.resolve(enabled));

    const result = await service.getEnabled();

    expect(result).toEqual(enabled);
    expect(mockRepo.findEnabled).toHaveBeenCalledTimes(1);
  });

  it("getEnabled returns empty array when none enabled", async () => {
    const result = await service.getEnabled();
    expect(result).toEqual([]);
  });

  // --- getById ---
  it("getById returns alarm when found", async () => {
    const alarm = makeAlarm();
    mockRepo.findById.mockReturnValue(Promise.resolve(alarm));

    const result = await service.getById("a-1");

    expect(result).toEqual(alarm);
    expect(mockRepo.findById).toHaveBeenCalledWith("a-1");
  });

  it("getById returns null when not found", async () => {
    const result = await service.getById("missing");
    expect(result).toBeNull();
  });

  // --- create ---
  it("create delegates to repo and returns alarm", async () => {
    const input = { time: "07:30", label: "Wake up" };
    const created = makeAlarm();
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.create(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  // --- update ---
  it("update returns updated alarm when found", async () => {
    const updated = makeAlarm({ label: "Sleep in" });
    mockRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.update("a-1", { label: "Sleep in" });

    expect(result).toEqual(updated);
    expect(mockRepo.update).toHaveBeenCalledWith("a-1", { label: "Sleep in" });
  });

  it("update returns null when alarm not found", async () => {
    const result = await service.update("missing", { label: "Nope" });
    expect(result).toBeNull();
  });

  // --- delete ---
  it("delete returns true when alarm deleted", async () => {
    mockRepo.delete.mockReturnValue(Promise.resolve(true));

    const result = await service.delete("a-1");

    expect(result).toBe(true);
    expect(mockRepo.delete).toHaveBeenCalledWith("a-1");
  });

  it("delete returns false when alarm not found", async () => {
    const result = await service.delete("missing");
    expect(result).toBe(false);
  });

  // --- markFired ---
  it("markFired calls repo.markFired", async () => {
    const alarm = makeAlarm({ repeatPattern: "daily" });
    mockRepo.findById.mockReturnValue(Promise.resolve(alarm));

    await service.markFired("a-1");

    expect(mockRepo.markFired).toHaveBeenCalledWith("a-1");
    expect(mockRepo.findById).toHaveBeenCalledWith("a-1");
  });

  it("markFired disables a 'once' alarm after firing", async () => {
    const alarm = makeAlarm({ repeatPattern: "once" });
    mockRepo.findById.mockReturnValue(Promise.resolve(alarm));

    await service.markFired("a-1");

    expect(mockRepo.markFired).toHaveBeenCalledWith("a-1");
    expect(mockRepo.update).toHaveBeenCalledWith("a-1", { enabled: false });
  });

  it("markFired does not disable a 'daily' alarm after firing", async () => {
    const alarm = makeAlarm({ repeatPattern: "daily" });
    mockRepo.findById.mockReturnValue(Promise.resolve(alarm));

    await service.markFired("a-1");

    expect(mockRepo.markFired).toHaveBeenCalledWith("a-1");
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("markFired does not disable if alarm not found after firing", async () => {
    // findById returns null (default mock)
    await service.markFired("missing");

    expect(mockRepo.markFired).toHaveBeenCalledWith("missing");
    expect(mockRepo.update).not.toHaveBeenCalled();
  });
});
