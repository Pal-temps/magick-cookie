import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ClickUpSyncService } from "../../application/connector/clickup-sync.service";
import type { ClickUpTask } from "../../domain/connector/clickup.entity";
import type { CalendarEvent } from "../../domain/event/event.entity";
import type { Calendar } from "../../domain/calendar/calendar.entity";

// --- Helpers ---

function makeTask(overrides: Partial<ClickUpTask> = {}): ClickUpTask {
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
    clickupTaskId: "task-1",
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
    findByClickUpTaskId: mock(() => Promise.resolve(null as CalendarEvent | null)),
    create: mock((input: any) => Promise.resolve(makeEvent(input))),
    update: mock((id: string, input: any) => Promise.resolve(makeEvent({ id, ...input }))),
    delete: mock(() => Promise.resolve(true)),
  };

  const mockConnectorRepo = {
    findUnscheduledTasks: mock(() => Promise.resolve([])),
    upsertUnscheduledTask: mock((task: any) =>
      Promise.resolve({ id: "unsched-1", createdAt: new Date(), updatedAt: new Date(), ...task }),
    ),
    deleteUnscheduledTasksNotIn: mock(() => Promise.resolve()),
  };

  const service = new ClickUpSyncService(
    mockApiClient as any,
    mockCalendarService as any,
    mockEventRepo as any,
    mockConnectorRepo as any,
  );

  return { service, mockApiClient, mockCalendarService, mockEventRepo, mockConnectorRepo };
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

  it("should create events for tasks with due_date", async () => {
    const { service, mockCalendarService, mockApiClient, mockEventRepo } = mocks;
    const dueDate = new Date("2026-04-01T10:00:00Z");
    const task = makeTask({ id: "t1", dueDate, startDate: null });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar({ id: "cal1" })]);
    mockApiClient.fetchAllTasks.mockResolvedValue([task]);
    mockEventRepo.findByClickUpTaskId.mockResolvedValue(null);

    await service.sync();

    expect(mockEventRepo.create).toHaveBeenCalledTimes(1);
    const arg = mockEventRepo.create.mock.calls[0][0];
    expect(arg.calendarId).toBe("cal1");
    expect(arg.title).toBe("My Task");
    expect(arg.clickupTaskId).toBe("t1");
    expect(arg.endAt).toEqual(dueDate);
  });

  it("should update existing events on re-sync", async () => {
    const { service, mockCalendarService, mockApiClient, mockEventRepo } = mocks;
    const dueDate = new Date("2026-04-01T10:00:00Z");
    const task = makeTask({ id: "t1", dueDate });
    const existingEvent = makeEvent({ id: "evt-existing", clickupTaskId: "t1" });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar({ id: "cal1" })]);
    mockApiClient.fetchAllTasks.mockResolvedValue([task]);
    mockEventRepo.findByClickUpTaskId.mockResolvedValue(existingEvent);

    await service.sync();

    expect(mockEventRepo.update).toHaveBeenCalledTimes(1);
    expect(mockEventRepo.update.mock.calls[0][0]).toBe("evt-existing");
    expect(mockEventRepo.create).not.toHaveBeenCalled();
  });

  it("should upsert unscheduled tasks for tasks without due_date", async () => {
    const { service, mockCalendarService, mockApiClient, mockConnectorRepo } = mocks;
    const task = makeTask({ id: "t-no-due", dueDate: null, name: "No Due" });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar()]);
    mockApiClient.fetchAllTasks.mockResolvedValue([task]);

    await service.sync();

    expect(mockConnectorRepo.upsertUnscheduledTask).toHaveBeenCalledTimes(1);
    const arg = mockConnectorRepo.upsertUnscheduledTask.mock.calls[0][0];
    expect(arg.clickupTaskId).toBe("t-no-due");
    expect(arg.name).toBe("No Due");
  });

  it("should cleanup stale unscheduled tasks", async () => {
    const { service, mockCalendarService, mockApiClient, mockConnectorRepo } = mocks;
    const t1 = makeTask({ id: "u1", dueDate: null });
    const t2 = makeTask({ id: "u2", dueDate: null });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar()]);
    mockApiClient.fetchAllTasks.mockResolvedValue([t1, t2]);

    await service.sync();

    expect(mockConnectorRepo.deleteUnscheduledTasksNotIn).toHaveBeenCalledTimes(1);
    const callArgs = mockConnectorRepo.deleteUnscheduledTasksNotIn.mock.calls[0] as unknown[];
    expect(callArgs[0]).toEqual(["u1", "u2"]);
  });

  it("should return correct counts", async () => {
    const { service, mockCalendarService, mockApiClient, mockEventRepo } = mocks;
    const due1 = new Date("2026-04-01T10:00:00Z");
    const due2 = new Date("2026-04-02T10:00:00Z");

    const taskNew = makeTask({ id: "new-1", dueDate: due1 });
    const taskExisting = makeTask({ id: "existing-1", dueDate: due2 });
    const taskNoDue = makeTask({ id: "no-due-1", dueDate: null });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar()]);
    mockApiClient.fetchAllTasks.mockResolvedValue([taskNew, taskExisting, taskNoDue]);

    // First call (new-1) returns null, second call (existing-1) returns existing event
    mockEventRepo.findByClickUpTaskId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeEvent({ id: "evt-x", clickupTaskId: "existing-1" }));

    const result = await service.sync();

    expect(result).toEqual({
      eventsCreated: 1,
      eventsUpdated: 1,
      unscheduledCount: 1,
    });
  });

  it("should handle tasks with start_date and due_date", async () => {
    const { service, mockCalendarService, mockApiClient, mockEventRepo } = mocks;
    const startDate = new Date("2026-04-01T08:00:00Z");
    const dueDate = new Date("2026-04-01T12:00:00Z");
    const task = makeTask({ id: "t-range", startDate, dueDate });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar({ id: "cal1" })]);
    mockApiClient.fetchAllTasks.mockResolvedValue([task]);
    mockEventRepo.findByClickUpTaskId.mockResolvedValue(null);

    await service.sync();

    const arg = mockEventRepo.create.mock.calls[0][0];
    expect(arg.startAt).toEqual(startDate);
    expect(arg.endAt).toEqual(dueDate);
  });

  it("should make 1h event when only due_date (no start_date)", async () => {
    const { service, mockCalendarService, mockApiClient, mockEventRepo } = mocks;
    const dueDate = new Date("2026-04-01T15:00:00Z");
    const task = makeTask({ id: "t-due-only", dueDate, startDate: null });

    mockCalendarService.getAll.mockResolvedValue([makeCalendar({ id: "cal1" })]);
    mockApiClient.fetchAllTasks.mockResolvedValue([task]);
    mockEventRepo.findByClickUpTaskId.mockResolvedValue(null);

    await service.sync();

    const arg = mockEventRepo.create.mock.calls[0][0];
    expect(arg.endAt).toEqual(dueDate);
    const expectedStart = new Date(dueDate.getTime() - 60 * 60 * 1000);
    expect(arg.startAt).toEqual(expectedStart);
  });
});
