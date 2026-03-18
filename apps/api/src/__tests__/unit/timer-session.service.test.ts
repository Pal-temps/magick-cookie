import { describe, it, expect, beforeEach, mock } from "bun:test";
import { TimerSessionService } from "../../application/timer-session/timer-session.service";
import type { TimerSessionRepository, DailyTimerStats } from "../../domain/timer-session/timer-session.repository";
import type { TimerSession } from "../../domain/timer-session/timer-session.entity";

const makeSession = (overrides: Partial<TimerSession> = {}): TimerSession => ({
  id: "ts-1",
  mode: "focus",
  durationMinutes: 25,
  actualSeconds: 1500,
  startedAt: new Date("2026-03-18T10:00:00Z"),
  endedAt: new Date("2026-03-18T10:25:00Z"),
  completed: true,
  label: null,
  taskId: null,
  projectId: null,
  createdAt: new Date("2026-03-18T10:00:00Z"),
  ...overrides,
});

describe("TimerSessionService", () => {
  let service: TimerSessionService;
  let mockRepo: Record<keyof TimerSessionRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findByTaskId: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve(makeSession())),
      getTodayStats: mock(() => Promise.resolve({ totalSeconds: 0, sessionCount: 0 })),
      getDailyStats: mock(() => Promise.resolve([])),
    };
    service = new TimerSessionService(mockRepo as unknown as TimerSessionRepository);
  });

  // --- getAll ---
  it("getAll returns sessions without date filters", async () => {
    const sessions = [makeSession()];
    mockRepo.findAll.mockReturnValue(Promise.resolve(sessions));

    const result = await service.getAll();

    expect(result).toEqual(sessions);
    expect(mockRepo.findAll).toHaveBeenCalledWith(undefined, undefined);
  });

  it("getAll passes date filters to repo", async () => {
    const from = new Date("2026-03-01");
    const to = new Date("2026-03-31");
    mockRepo.findAll.mockReturnValue(Promise.resolve([]));

    await service.getAll(from, to);

    expect(mockRepo.findAll).toHaveBeenCalledWith(from, to);
  });

  it("getAll returns empty array when no sessions", async () => {
    const result = await service.getAll();
    expect(result).toEqual([]);
  });

  // --- create ---
  it("create delegates to repo and returns session", async () => {
    const input = {
      mode: "focus",
      durationMinutes: 25,
      actualSeconds: 1500,
      startedAt: new Date("2026-03-18T10:00:00Z"),
      endedAt: new Date("2026-03-18T10:25:00Z"),
      completed: true,
    };
    const created = makeSession();
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.create(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  // --- getTodayStats ---
  it("getTodayStats returns stats from repo", async () => {
    const stats = { totalSeconds: 3600, sessionCount: 3 };
    mockRepo.getTodayStats.mockReturnValue(Promise.resolve(stats));

    const result = await service.getTodayStats();

    expect(result).toEqual(stats);
    expect(mockRepo.getTodayStats).toHaveBeenCalledTimes(1);
  });

  // --- getDailyStats ---
  it("getDailyStats returns stats from repo", async () => {
    const from = new Date("2026-03-01");
    const to = new Date("2026-03-18");
    const stats: DailyTimerStats[] = [
      { date: "2026-03-18", totalSeconds: 1500, focusSeconds: 1500, sessionCount: 1, completedCount: 1, cancelledCount: 0 },
    ];
    mockRepo.getDailyStats.mockReturnValue(Promise.resolve(stats));

    const result = await service.getDailyStats(from, to);

    expect(result).toEqual(stats);
    expect(mockRepo.getDailyStats).toHaveBeenCalledWith(from, to);
  });

  it("getDailyStats returns empty array for no data", async () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-01-31");

    const result = await service.getDailyStats(from, to);

    expect(result).toEqual([]);
  });
});
