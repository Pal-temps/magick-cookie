import { describe, it, expect, beforeEach, mock } from "bun:test";
import { WellnessLogService } from "../../application/wellness-log/wellness-log.service";
import type { WellnessLogRepository } from "../../domain/wellness-log/wellness-log.repository";
import type { WellnessLog } from "../../domain/wellness-log/wellness-log.entity";

const makeLog = (overrides: Partial<WellnessLog> = {}): WellnessLog => ({
  id: "wl-1",
  type: "water",
  date: "2026-03-18",
  value: 500,
  goal: 2000,
  createdAt: new Date("2026-03-18"),
  updatedAt: new Date("2026-03-18"),
  ...overrides,
});

describe("WellnessLogService", () => {
  let service: WellnessLogService;
  let mockRepo: Record<keyof WellnessLogRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findByDateAndType: mock(() => Promise.resolve(null)),
      findByDate: mock(() => Promise.resolve([])),
      findByRange: mock(() => Promise.resolve([])),
      upsert: mock(() => Promise.resolve(makeLog())),
      increment: mock(() => Promise.resolve(null)),
    };
    service = new WellnessLogService(mockRepo as unknown as WellnessLogRepository);
  });

  // --- getByDate ---
  it("getByDate returns logs for a date", async () => {
    const logs = [makeLog(), makeLog({ id: "wl-2", type: "break" })];
    mockRepo.findByDate.mockReturnValue(Promise.resolve(logs));

    const result = await service.getByDate("2026-03-18");

    expect(result).toEqual(logs);
    expect(mockRepo.findByDate).toHaveBeenCalledWith("2026-03-18");
  });

  it("getByDate returns empty array when no logs", async () => {
    const result = await service.getByDate("2026-03-18");
    expect(result).toEqual([]);
  });

  // --- getByDateAndType ---
  it("getByDateAndType returns log when found", async () => {
    const log = makeLog();
    mockRepo.findByDateAndType.mockReturnValue(Promise.resolve(log));

    const result = await service.getByDateAndType("2026-03-18", "water");

    expect(result).toEqual(log);
    expect(mockRepo.findByDateAndType).toHaveBeenCalledWith("2026-03-18", "water");
  });

  it("getByDateAndType returns null when not found", async () => {
    const result = await service.getByDateAndType("2026-03-18", "water");
    expect(result).toBeNull();
  });

  // --- getByRange ---
  it("getByRange returns logs in range", async () => {
    const logs = [makeLog()];
    mockRepo.findByRange.mockReturnValue(Promise.resolve(logs));

    const result = await service.getByRange("2026-03-01", "2026-03-31");

    expect(result).toEqual(logs);
    expect(mockRepo.findByRange).toHaveBeenCalledWith("2026-03-01", "2026-03-31", undefined);
  });

  it("getByRange passes type filter", async () => {
    mockRepo.findByRange.mockReturnValue(Promise.resolve([]));

    await service.getByRange("2026-03-01", "2026-03-31", "water");

    expect(mockRepo.findByRange).toHaveBeenCalledWith("2026-03-01", "2026-03-31", "water");
  });

  // --- increment ---
  it("increment updates existing log", async () => {
    const existing = makeLog({ value: 500 });
    mockRepo.findByDateAndType.mockReturnValue(Promise.resolve(existing));
    const incremented = makeLog({ value: 750 });
    mockRepo.increment.mockReturnValue(Promise.resolve(incremented));

    const result = await service.increment("2026-03-18", "water", 250);

    expect(result).toEqual(incremented);
    expect(mockRepo.increment).toHaveBeenCalledWith("2026-03-18", "water", 250);
  });

  it("increment returns existing when repo.increment returns null", async () => {
    const existing = makeLog({ value: 500 });
    mockRepo.findByDateAndType.mockReturnValue(Promise.resolve(existing));
    mockRepo.increment.mockReturnValue(Promise.resolve(null));

    const result = await service.increment("2026-03-18", "water", 250);

    expect(result).toEqual(existing);
  });

  it("increment creates new log when none exists for known type", async () => {
    // "water" has default goal of 2000
    const created = makeLog({ value: 250, goal: 2000 });
    mockRepo.upsert.mockReturnValue(Promise.resolve(created));

    const result = await service.increment("2026-03-18", "water", 250);

    expect(result).toEqual(created);
    expect(mockRepo.upsert).toHaveBeenCalledWith({
      type: "water",
      date: "2026-03-18",
      value: 250,
      goal: 2000,
    });
  });

  it("increment creates new log with default goal of 1 for unknown type", async () => {
    const created = makeLog({ type: "custom", value: 1, goal: 1 });
    mockRepo.upsert.mockReturnValue(Promise.resolve(created));

    const result = await service.increment("2026-03-18", "custom", 1);

    expect(result).toEqual(created);
    expect(mockRepo.upsert).toHaveBeenCalledWith({
      type: "custom",
      date: "2026-03-18",
      value: 1,
      goal: 1,
    });
  });

  it("increment clamps new log value to 0 when amount is negative", async () => {
    const created = makeLog({ value: 0, goal: 2000 });
    mockRepo.upsert.mockReturnValue(Promise.resolve(created));

    const result = await service.increment("2026-03-18", "water", -100);

    expect(mockRepo.upsert).toHaveBeenCalledWith({
      type: "water",
      date: "2026-03-18",
      value: 0,
      goal: 2000,
    });
  });

  it("increment uses fruits_veggies default goal", async () => {
    const created = makeLog({ type: "fruits_veggies", value: 1, goal: 5 });
    mockRepo.upsert.mockReturnValue(Promise.resolve(created));

    await service.increment("2026-03-18", "fruits_veggies", 1);

    expect(mockRepo.upsert).toHaveBeenCalledWith({
      type: "fruits_veggies",
      date: "2026-03-18",
      value: 1,
      goal: 5,
    });
  });

  // --- setGoal ---
  it("setGoal updates goal on existing log", async () => {
    const existing = makeLog({ value: 500 });
    mockRepo.findByDateAndType.mockReturnValue(Promise.resolve(existing));
    const updated = makeLog({ value: 500, goal: 3000 });
    mockRepo.upsert.mockReturnValue(Promise.resolve(updated));

    const result = await service.setGoal("2026-03-18", "water", 3000);

    expect(result).toEqual(updated);
    expect(mockRepo.upsert).toHaveBeenCalledWith({
      type: "water",
      date: "2026-03-18",
      value: 500,
      goal: 3000,
    });
  });

  it("setGoal creates new log with value 0 when none exists", async () => {
    const created = makeLog({ value: 0, goal: 3000 });
    mockRepo.upsert.mockReturnValue(Promise.resolve(created));

    const result = await service.setGoal("2026-03-18", "water", 3000);

    expect(result).toEqual(created);
    expect(mockRepo.upsert).toHaveBeenCalledWith({
      type: "water",
      date: "2026-03-18",
      value: 0,
      goal: 3000,
    });
  });
});
