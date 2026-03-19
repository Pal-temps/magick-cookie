import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ClickUpSyncService } from "../../application/connector/clickup-sync.service";
import type { ClickUpTask } from "../../infrastructure/connectors/clickup-api.client";
import type { CalendarEvent } from "../../domain/event/event.entity";
import type { Calendar } from "../../domain/calendar/calendar.entity";
import type { Task } from "../../domain/task/task.entity";

// --- Helpers ---

function makeClickUpTask(overrides: Partial<ClickUpTask> = {}): ClickUpTask {
  return {
    id: "task-1",
    name: "My Task",
    description: "A description",
    status: "in progress",
    dueDate: null,
    startDate: null,
    url: "https://app.clickup.com/t/task-1",
    listName: "Sprint 1",
    spaceName: "space-1",
    priority: "high",
    assignees: ["alice"],
    ...overrides,
  };
}

function makeCalendar(overrides: Partial<Calendar> = {}): Calendar {
  return {
    id: "cal-1",
    name: "ClickUp",
    description: null,
    color: "#7B68EE",
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
    title: "My Task",
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
    externalId: "task-1",
    source: "clickup",
    title: "My Task",
    description: "A description",
    status: "in progress",
    priority: "high",
    url: "https://app.clickup.com/t/task-1",
    labels: ["Sprint 1"],
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
  const mockApiClient = {
    fetchAllTasks: mock(() => Promise.resolve([] as ClickUpTask[])),
  };

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

  // Pass mockApiClient as the 5th arg (clientOverride) so the service uses it directly
  const service = new ClickUpSyncService(
    mockConnectorConfigRepo as any,
    mockCalendarService as any,
    mockEventRepo as any,
    mockTaskRepo as any,
    mockApiClient as any,
  );

  return { service, mockApiClient, mockConnectorConfigRepo, mockCalendarService, mockEventRepo, mockTaskRepo };
}

// --- Tests ---

describe("ClickUpSyncService", () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it("should create ClickUp calendar if it doesn't exist", async () => {
    const { service, mockCalendarService, mockApiClient } = mocks;
    mockCalendarService.getAll.mockResolvedValue([]);
    mockApiClient.fetchAllTasks.mockResolvedValue([]);

    await service.sync();

    expect(mockCalendarService.create).toHaveBeenCalledTimes(1);
    const callArg = mockCalendarService.create.mock.calls[0][0];
    expect(callArg.name).toBe("ClickUp");
    expect(callArg.color).toBe("#7B68EE");
  });

  it("should reuse existing ClickUp calendar", async () => {
    const { service, mockCalendarService, mockApiClient } = mocks;
    mockCalendarService.getAll.mockResolvedValue([makeCalendar({ id: "cal1", name: "ClickUp" })]);
    mockApiClient.fetchAllTasks.mockResolvedValue([]);

    await service.sync();

    expect(mockCalendarService.create).not.toHaveBeenCalled();
  });

  it("should upsert tasks and create events for tasks with due_date", async () => {
    const { service, mockCalendarService, mockApiClient, mockEventRepo, mockTaskRepo } = mocks;
    const dueDate = new Date("2026-04-01T10:00:00Z");
    const task = makeClickUpTask({ id: "t1", dueDate, startDate: null });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar({ id: "cal1" })]);
    mockApiClient.fetchAllTasks.mockResolvedValue([task]);
    mockTaskRepo.upsertByExternalId.mockResolvedValue(makeLocalTask({ id: "local-t1", externalId: "t1" }));
    mockEventRepo.findByTaskId.mockResolvedValue(null);

    await service.sync();

    expect(mockTaskRepo.upsertByExternalId).toHaveBeenCalledTimes(1);
    expect(mockEventRepo.create).toHaveBeenCalledTimes(1);
    const arg = mockEventRepo.create.mock.calls[0][0];
    expect(arg.calendarId).toBe("cal1");
    expect(arg.title).toBe("My Task");
    expect(arg.taskId).toBe("local-t1");
    expect(arg.endAt).toEqual(dueDate);
  });

  it("should update existing events on re-sync", async () => {
    const { service, mockCalendarService, mockApiClient, mockEventRepo, mockTaskRepo } = mocks;
    const dueDate = new Date("2026-04-01T10:00:00Z");
    const task = makeClickUpTask({ id: "t1", dueDate });
    const existingEvent = makeEvent({ id: "evt-existing", taskId: "local-t1" });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar({ id: "cal1" })]);
    mockApiClient.fetchAllTasks.mockResolvedValue([task]);
    mockTaskRepo.upsertByExternalId.mockResolvedValue(makeLocalTask({ id: "local-t1", externalId: "t1" }));
    mockEventRepo.findByTaskId.mockResolvedValue(existingEvent);

    await service.sync();

    expect(mockEventRepo.update).toHaveBeenCalledTimes(1);
    expect(mockEventRepo.update.mock.calls[0][0]).toBe("evt-existing");
    expect(mockEventRepo.create).not.toHaveBeenCalled();
  });

  it("should upsert tasks without due_date into tasks table", async () => {
    const { service, mockCalendarService, mockApiClient, mockTaskRepo } = mocks;
    const task = makeClickUpTask({ id: "t-no-due", dueDate: null, name: "No Due" });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar()]);
    mockApiClient.fetchAllTasks.mockResolvedValue([task]);

    await service.sync();

    expect(mockTaskRepo.upsertByExternalId).toHaveBeenCalledTimes(1);
    const arg = mockTaskRepo.upsertByExternalId.mock.calls[0][0];
    expect(arg.externalId).toBe("t-no-due");
    expect(arg.title).toBe("No Due");
    expect(arg.source).toBe("clickup");
  });

  it("should cleanup stale tasks", async () => {
    const { service, mockCalendarService, mockApiClient, mockTaskRepo } = mocks;
    const t1 = makeClickUpTask({ id: "u1", dueDate: null });
    const t2 = makeClickUpTask({ id: "u2", dueDate: null });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar()]);
    mockApiClient.fetchAllTasks.mockResolvedValue([t1, t2]);

    await service.sync();

    expect(mockTaskRepo.deleteNotInExternalIds).toHaveBeenCalledTimes(1);
    const callArgs = mockTaskRepo.deleteNotInExternalIds.mock.calls[0] as unknown[];
    expect(callArgs[0]).toBe("clickup");
    expect(callArgs[1]).toEqual(["u1", "u2"]);
  });

  it("should return correct counts", async () => {
    const { service, mockCalendarService, mockApiClient, mockEventRepo, mockTaskRepo } = mocks;
    const due1 = new Date("2026-04-01T10:00:00Z");
    const due2 = new Date("2026-04-02T10:00:00Z");

    const taskNew = makeClickUpTask({ id: "new-1", dueDate: due1 });
    const taskExisting = makeClickUpTask({ id: "existing-1", dueDate: due2 });
    const taskNoDue = makeClickUpTask({ id: "no-due-1", dueDate: null });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar()]);
    mockApiClient.fetchAllTasks.mockResolvedValue([taskNew, taskExisting, taskNoDue]);

    mockTaskRepo.upsertByExternalId
      .mockResolvedValueOnce(makeLocalTask({ id: "local-new-1", externalId: "new-1" }))
      .mockResolvedValueOnce(makeLocalTask({ id: "local-existing-1", externalId: "existing-1" }))
      .mockResolvedValueOnce(makeLocalTask({ id: "local-no-due-1", externalId: "no-due-1" }));

    // First call (new-1) returns null, second call (existing-1) returns existing event
    mockEventRepo.findByTaskId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeEvent({ id: "evt-x", taskId: "local-existing-1" }));

    const result = await service.sync();

    expect(result).toEqual({
      eventsCreated: 1,
      eventsUpdated: 1,
      tasksUpserted: 3,
    });
  });

  it("should handle tasks with start_date and due_date", async () => {
    const { service, mockCalendarService, mockApiClient, mockEventRepo, mockTaskRepo } = mocks;
    const startDate = new Date("2026-04-01T08:00:00Z");
    const dueDate = new Date("2026-04-01T12:00:00Z");
    const task = makeClickUpTask({ id: "t-range", startDate, dueDate });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar({ id: "cal1" })]);
    mockApiClient.fetchAllTasks.mockResolvedValue([task]);
    mockTaskRepo.upsertByExternalId.mockResolvedValue(makeLocalTask({ id: "local-t-range", externalId: "t-range" }));
    mockEventRepo.findByTaskId.mockResolvedValue(null);

    await service.sync();

    const arg = mockEventRepo.create.mock.calls[0][0];
    expect(arg.startAt).toEqual(startDate);
    expect(arg.endAt).toEqual(dueDate);
  });

  it("should make 1h event when only due_date (no start_date)", async () => {
    const { service, mockCalendarService, mockApiClient, mockEventRepo, mockTaskRepo } = mocks;
    const dueDate = new Date("2026-04-01T15:00:00Z");
    const task = makeClickUpTask({ id: "t-due-only", dueDate, startDate: null });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar({ id: "cal1" })]);
    mockApiClient.fetchAllTasks.mockResolvedValue([task]);
    mockTaskRepo.upsertByExternalId.mockResolvedValue(makeLocalTask({ id: "local-t-due-only", externalId: "t-due-only" }));
    mockEventRepo.findByTaskId.mockResolvedValue(null);

    await service.sync();

    const arg = mockEventRepo.create.mock.calls[0][0];
    expect(arg.endAt).toEqual(dueDate);
    const expectedStart = new Date(dueDate.getTime() - 60 * 60 * 1000);
    expect(arg.startAt).toEqual(expectedStart);
  });

  it("should throw if connector not configured and no client override", async () => {
    const mockConnectorConfigRepo = {
      findByType: mock(() => Promise.resolve(null)),
      findAll: mock(() => Promise.resolve([])),
      upsert: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve()),
    };

    // No clientOverride → service must read from connectorConfigRepo
    const service = new ClickUpSyncService(
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
  });
});
