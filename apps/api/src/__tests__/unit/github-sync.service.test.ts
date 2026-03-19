import { describe, it, expect, mock, beforeEach } from "bun:test";
import { GitHubSyncService } from "../../application/connector/github-sync.service";
import type { CalendarEvent } from "../../domain/event/event.entity";
import type { Calendar } from "../../domain/calendar/calendar.entity";
import type { Task } from "../../domain/task/task.entity";

// --- Helpers ---

function makeCalendar(overrides: Partial<Calendar> = {}): Calendar {
  return {
    id: "cal-1",
    name: "GitHub",
    description: null,
    color: "#24292e",
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    calendarId: "cal-1",
    title: "My Issue",
    description: "desc",
    location: null,
    startAt: new Date(),
    endAt: new Date(),
    isAllDay: false,
    recurrenceRule: null,
    taskId: "local-task-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeLocalTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "local-task-1",
    externalId: "owner/repo#1",
    source: "github",
    title: "My Issue",
    description: "A description",
    status: "open",
    priority: null,
    url: "https://github.com/owner/repo/issues/1",
    labels: ["bug"],
    assignees: ["alice"],
    dueDate: null,
    startDate: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// --- Mock factories ---

function createMocks() {
  const mockConnectorConfigRepo = {
    findByType: mock(() => Promise.resolve(null)),
    findAll: mock(() => Promise.resolve([])),
    upsert: mock(() => Promise.resolve(null)),
    delete: mock(() => Promise.resolve()),
  };

  const mockCalendarService = {
    getAll: mock(() => Promise.resolve([] as Calendar[])),
    create: mock((input: any) => Promise.resolve(makeCalendar(input))),
    getById: mock(() => Promise.resolve(null)),
    update: mock(() => Promise.resolve(null)),
    delete: mock(() => Promise.resolve(false)),
  };

  const mockEventRepo = {
    findAll: mock(() => Promise.resolve([])),
    findByCalendarId: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    findByTaskId: mock(() => Promise.resolve(null as CalendarEvent | null)),
    create: mock((input: any) => Promise.resolve(makeEvent(input))),
    update: mock((id: string, input: any) => Promise.resolve(makeEvent({ id, ...input }))),
    delete: mock(() => Promise.resolve(true)),
  };

  const mockTaskRepo = {
    findAll: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    findByExternalId: mock(() => Promise.resolve(null)),
    findBySource: mock(() => Promise.resolve([])),
    findUnscheduled: mock(() => Promise.resolve([])),
    upsertByExternalId: mock((input: any) =>
      Promise.resolve(makeLocalTask({ id: `local-${input.externalId}`, externalId: input.externalId, title: input.title })),
    ),
    create: mock(() => Promise.resolve(makeLocalTask())),
    deleteBySource: mock(() => Promise.resolve()),
    deleteNotInExternalIds: mock(() => Promise.resolve()),
    delete: mock(() => Promise.resolve(true)),
  };

  const service = new GitHubSyncService(
    mockConnectorConfigRepo as any,
    mockCalendarService as any,
    mockEventRepo as any,
    mockTaskRepo as any,
  );

  return { service, mockConnectorConfigRepo, mockCalendarService, mockEventRepo, mockTaskRepo };
}

// --- Tests ---

describe("GitHubSyncService", () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it("should throw if GitHub connector not configured", async () => {
    const { service, mockConnectorConfigRepo } = mocks;
    mockConnectorConfigRepo.findByType.mockResolvedValue(null);

    try {
      await service.sync();
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message).toContain("not configured");
    }
  });

  it("should throw if GitHub connector disabled", async () => {
    const { service, mockConnectorConfigRepo } = mocks;
    mockConnectorConfigRepo.findByType.mockResolvedValue({
      id: "cfg-1",
      type: "github",
      enabled: false,
      token: "ghp_test",
      settings: { username: "alice", repos: ["owner/repo"] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      await service.sync();
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message).toContain("not configured or disabled");
    }
  });

  it("should return zeros when no repos configured", async () => {
    const { service, mockConnectorConfigRepo } = mocks;
    mockConnectorConfigRepo.findByType.mockResolvedValue({
      id: "cfg-1",
      type: "github",
      enabled: true,
      token: "ghp_test",
      settings: { username: "alice", repos: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.sync();

    expect(result).toEqual({
      eventsCreated: 0,
      eventsUpdated: 0,
      tasksUpserted: 0,
    });
  });

  it("should throw if GitHub connector not configured (null config)", async () => {
    // Create service with a fresh repo that returns null
    const mockConnectorConfigRepo = {
      findByType: mock(() => Promise.resolve(null)),
      findAll: mock(() => Promise.resolve([])),
      upsert: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve()),
    };

    const service = new GitHubSyncService(
      mockConnectorConfigRepo as any,
      {} as any,
      {} as any,
      {} as any,
    );

    try {
      await service.sync();
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message).toContain("not configured");
    }

    expect(mockConnectorConfigRepo.findByType).toHaveBeenCalledWith("github");
  });
});
