import { describe, it, expect, beforeEach, mock } from "bun:test";
import { RoutineService } from "../../application/routine/routine.service";
import type { RoutineRepository } from "../../domain/routine/routine.repository";
import type { Routine } from "../../domain/routine/routine.entity";

const makeRoutine = (overrides: Partial<Routine> = {}): Routine => ({
  id: "rt-1",
  name: "Morning brief",
  triggerTime: "08:00",
  triggerDays: [1, 2, 3, 4, 5],
  steps: [{ action: "sync", target: "email" }, { action: "generate", target: "brief" }],
  enabled: true,
  lastRunAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("RoutineService", () => {
  let service: RoutineService;
  let mockRepo: Record<keyof RoutineRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findEnabled: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve(makeRoutine())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
      markRun: mock(() => Promise.resolve()),
    };
    service = new RoutineService(mockRepo as unknown as RoutineRepository);
  });

  // --- getAll ---
  it("getAll returns all routines", async () => {
    const routines = [makeRoutine(), makeRoutine({ id: "rt-2", name: "Evening sync" })];
    mockRepo.findAll.mockReturnValue(Promise.resolve(routines));

    const result = await service.getAll();

    expect(result).toEqual(routines);
    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it("getAll returns empty array when none", async () => {
    const result = await service.getAll();
    expect(result).toEqual([]);
  });

  // --- getById ---
  it("getById returns routine when found", async () => {
    const routine = makeRoutine();
    mockRepo.findById.mockReturnValue(Promise.resolve(routine));

    const result = await service.getById("rt-1");

    expect(result).toEqual(routine);
    expect(mockRepo.findById).toHaveBeenCalledWith("rt-1");
  });

  it("getById returns null when not found", async () => {
    const result = await service.getById("missing");
    expect(result).toBeNull();
  });

  // --- getEnabled ---
  it("getEnabled returns only enabled routines", async () => {
    const enabled = [makeRoutine()];
    mockRepo.findEnabled.mockReturnValue(Promise.resolve(enabled));

    const result = await service.getEnabled();

    expect(result).toEqual(enabled);
    expect(mockRepo.findEnabled).toHaveBeenCalledTimes(1);
  });

  it("getEnabled returns empty array when none enabled", async () => {
    const result = await service.getEnabled();
    expect(result).toEqual([]);
  });

  // --- create ---
  it("create delegates to repo and returns routine", async () => {
    const input = { name: "New routine", triggerTime: "09:00" };
    const created = makeRoutine({ name: "New routine", triggerTime: "09:00" });
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.create(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  // --- update ---
  it("update returns updated routine when found", async () => {
    const updated = makeRoutine({ name: "Updated" });
    mockRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.update("rt-1", { name: "Updated" });

    expect(result).toEqual(updated);
    expect(mockRepo.update).toHaveBeenCalledWith("rt-1", { name: "Updated" });
  });

  it("update returns null when not found", async () => {
    const result = await service.update("missing", { name: "Nope" });
    expect(result).toBeNull();
  });

  // --- delete ---
  it("delete returns true when deleted", async () => {
    mockRepo.delete.mockReturnValue(Promise.resolve(true));

    const result = await service.delete("rt-1");

    expect(result).toBe(true);
    expect(mockRepo.delete).toHaveBeenCalledWith("rt-1");
  });

  it("delete returns false when not found", async () => {
    const result = await service.delete("missing");
    expect(result).toBe(false);
  });

  // --- markRun ---
  it("markRun delegates to repo", async () => {
    await service.markRun("rt-1");

    expect(mockRepo.markRun).toHaveBeenCalledWith("rt-1");
    expect(mockRepo.markRun).toHaveBeenCalledTimes(1);
  });
});
