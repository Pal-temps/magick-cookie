import { describe, it, expect, beforeEach, mock } from "bun:test";
import { DogWalkService } from "../../application/dog-walk/dog-walk.service";
import type { DogWalkRepository } from "../../domain/dog-walk/dog-walk.repository";
import type { DogWalk } from "../../domain/dog-walk/dog-walk.entity";

const makeWalk = (overrides: Partial<DogWalk> = {}): DogWalk => ({
  id: "w-1",
  startedAt: new Date("2026-03-18T08:00:00Z"),
  endedAt: null,
  durationSeconds: null,
  notes: null,
  createdAt: new Date("2026-03-18T08:00:00Z"),
  ...overrides,
});

describe("DogWalkService", () => {
  let service: DogWalkService;
  let mockRepo: Record<keyof DogWalkRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findActive: mock(() => Promise.resolve(null)),
      findAll: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve(makeWalk())),
      stop: mock(() => Promise.resolve(makeWalk({ endedAt: new Date(), durationSeconds: 600 }))),
      getTodayStats: mock(() => Promise.resolve({ totalSeconds: 0, walkCount: 0 })),
      getDailyStats: mock(() => Promise.resolve([])),
    };
    service = new DogWalkService(mockRepo as unknown as DogWalkRepository);
  });

  // --- getActive ---
  it("getActive returns active walk", async () => {
    const walk = makeWalk();
    mockRepo.findActive.mockReturnValue(Promise.resolve(walk));

    const result = await service.getActive();

    expect(result).toEqual(walk);
    expect(mockRepo.findActive).toHaveBeenCalledTimes(1);
  });

  it("getActive returns null when no active walk", async () => {
    const result = await service.getActive();
    expect(result).toBeNull();
  });

  // --- getAll ---
  it("getAll returns walks without date filters", async () => {
    const walks = [makeWalk()];
    mockRepo.findAll.mockReturnValue(Promise.resolve(walks));

    const result = await service.getAll();

    expect(result).toEqual(walks);
    expect(mockRepo.findAll).toHaveBeenCalledWith(undefined, undefined);
  });

  it("getAll passes date filters to repo", async () => {
    const from = new Date("2026-03-01");
    const to = new Date("2026-03-31");
    mockRepo.findAll.mockReturnValue(Promise.resolve([]));

    await service.getAll(from, to);

    expect(mockRepo.findAll).toHaveBeenCalledWith(from, to);
  });

  // --- start ---
  it("start creates a new walk when no active walk", async () => {
    const created = makeWalk();
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.start();

    expect(result).toEqual(created);
    expect(mockRepo.findActive).toHaveBeenCalledTimes(1);
    expect(mockRepo.create).toHaveBeenCalledWith({});
  });

  it("start passes input to create", async () => {
    const input = { notes: "Morning walk" };
    const created = makeWalk({ notes: "Morning walk" });
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.start(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  it("start throws when a walk is already in progress", async () => {
    mockRepo.findActive.mockReturnValue(Promise.resolve(makeWalk()));

    await expect(service.start()).rejects.toThrow("A walk is already in progress");
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  // --- stop ---
  it("stop ends the active walk", async () => {
    const activeWalk = makeWalk({ id: "w-1", startedAt: new Date("2026-03-18T08:00:00Z") });
    mockRepo.findActive.mockReturnValue(Promise.resolve(activeWalk));
    const stoppedWalk = makeWalk({ id: "w-1", endedAt: new Date(), durationSeconds: 600 });
    mockRepo.stop.mockReturnValue(Promise.resolve(stoppedWalk));

    const result = await service.stop("w-1");

    expect(result).toEqual(stoppedWalk);
    expect(mockRepo.stop).toHaveBeenCalledWith("w-1", expect.objectContaining({
      endedAt: expect.any(Date),
      durationSeconds: expect.any(Number),
    }));
  });

  it("stop throws when no active walk found", async () => {
    mockRepo.findActive.mockReturnValue(Promise.resolve(null));

    await expect(service.stop("w-1")).rejects.toThrow("No active walk found with this id");
  });

  it("stop throws when active walk id does not match", async () => {
    mockRepo.findActive.mockReturnValue(Promise.resolve(makeWalk({ id: "w-other" })));

    await expect(service.stop("w-1")).rejects.toThrow("No active walk found with this id");
  });

  // --- getTodayStats ---
  it("getTodayStats returns stats from repo", async () => {
    const stats = { totalSeconds: 1800, walkCount: 2 };
    mockRepo.getTodayStats.mockReturnValue(Promise.resolve(stats));

    const result = await service.getTodayStats();

    expect(result).toEqual(stats);
  });

  // --- getDailyStats ---
  it("getDailyStats returns stats from repo", async () => {
    const from = new Date("2026-03-01");
    const to = new Date("2026-03-18");
    const stats = [{ date: "2026-03-18", totalSeconds: 900, walkCount: 1 }];
    mockRepo.getDailyStats.mockReturnValue(Promise.resolve(stats));

    const result = await service.getDailyStats(from, to);

    expect(result).toEqual(stats);
    expect(mockRepo.getDailyStats).toHaveBeenCalledWith(from, to);
  });
});
