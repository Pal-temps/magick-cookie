import { describe, it, expect, mock, beforeEach } from "bun:test";
import { GitLabSyncService } from "../../application/connector/gitlab-sync.service";
import type { CalendarEvent } from "../../domain/event/event.entity";
import type { Calendar } from "../../domain/calendar/calendar.entity";
import type { Task } from "../../domain/task/task.entity";

// --- Helpers ---

function makeCalendar(overrides: Partial<Calendar> = {}): Calendar {
  return {
    id: "cal-1",
    name: "GitLab",
    description: null,
    color: "#fc6d26",
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
    externalId: "project:42#iid:1",
    source: "gitlab",
    title: "My Issue",
    description: "A description",
    status: "opened",
    priority: null,
    url: "https://gitlab.com/group/project/-/issues/1",
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

  const service = new GitLabSyncService(
    mockConnectorConfigRepo as any,
    mockCalendarService as any,
    mockEventRepo as any,
    mockTaskRepo as any,
  );

  return { service, mockConnectorConfigRepo, mockCalendarService, mockEventRepo, mockTaskRepo };
}

// --- Tests ---

describe("GitLabSyncService", () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it("should throw if GitLab connector not configured", async () => {
    const { service, mockConnectorConfigRepo } = mocks;
    mockConnectorConfigRepo.findByType.mockResolvedValue(null);

    try {
      await service.sync();
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message).toContain("not configured");
    }

    expect(mockConnectorConfigRepo.findByType).toHaveBeenCalledWith("gitlab");
  });

  it("should throw if GitLab connector disabled", async () => {
    const { service, mockConnectorConfigRepo } = mocks;
    mockConnectorConfigRepo.findByType.mockResolvedValue({
      id: "cfg-1",
      type: "gitlab",
      enabled: false,
      token: "glpat-test",
      settings: { baseUrl: "https://gitlab.com", projectIds: [42] },
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

  it("should return zeros when no projectIds configured", async () => {
    const { service, mockConnectorConfigRepo } = mocks;
    mockConnectorConfigRepo.findByType.mockResolvedValue({
      id: "cfg-1",
      type: "gitlab",
      enabled: true,
      token: "glpat-test",
      settings: { baseUrl: "https://gitlab.com", projectIds: [] },
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
});
