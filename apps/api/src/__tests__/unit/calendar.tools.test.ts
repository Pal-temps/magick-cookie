import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createCalendarTools } from "../../application/agent/tools/calendar.tools";
import type { AgentTool } from "../../application/agent/tool-registry";
import type { EventService } from "../../application/event/event.service";
import type { CalendarService } from "../../application/calendar/calendar.service";
import type { LlmService } from "../../application/llm/llm.service";
import type { CalendarEvent } from "../../domain/event/event.entity";
import type { Calendar } from "../../domain/calendar/calendar.entity";

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "evt-1",
  calendarId: "cal-1",
  title: "Meeting",
  description: null,
  location: null,
  latitude: null,
  longitude: null,
  startAt: new Date("2026-04-28T09:00:00Z"),
  endAt: new Date("2026-04-28T10:00:00Z"),
  isAllDay: false,
  recurrenceRule: null,
  taskId: null,
  createdAt: new Date("2026-04-28T08:00:00Z"),
  updatedAt: new Date("2026-04-28T08:00:00Z"),
  ...overrides,
});

const makeCalendar = (overrides: Partial<Calendar> = {}): Calendar => ({
  id: "cal-1",
  name: "Personal",
  description: null,
  color: "#6c5ce7",
  isDefault: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("calendar.tools", () => {
  let eventService: { [K in keyof EventService]: ReturnType<typeof mock> };
  let calendarService: { [K in keyof CalendarService]: ReturnType<typeof mock> };
  let llmService: { generateEvents: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let listTool: AgentTool;
  let createTool: AgentTool;
  let updateTool: AgentTool;
  let deleteTool: AgentTool;
  let conflictTool: AgentTool;
  let generateTool: AgentTool;

  beforeEach(() => {
    eventService = {
      getAll: mock(() => Promise.resolve([])),
      getByCalendarId: mock(() => Promise.resolve([])),
      getById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeEvent())),
      update: mock(() => Promise.resolve(makeEvent())),
      delete: mock(() => Promise.resolve(true)),
    } as unknown as { [K in keyof EventService]: ReturnType<typeof mock> };

    calendarService = {
      getAll: mock(() => Promise.resolve([])),
      getById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeCalendar())),
      update: mock(() => Promise.resolve(makeCalendar())),
      delete: mock(() => Promise.resolve(true)),
    } as unknown as { [K in keyof CalendarService]: ReturnType<typeof mock> };

    llmService = { generateEvents: mock(() => Promise.resolve([])) };

    tools = createCalendarTools(
      eventService as unknown as EventService,
      calendarService as unknown as CalendarService,
      llmService as unknown as LlmService,
    );
    listTool = tools.find((t) => t.name === "calendar_list")!;
    createTool = tools.find((t) => t.name === "calendar_create_event")!;
    updateTool = tools.find((t) => t.name === "calendar_update_event")!;
    deleteTool = tools.find((t) => t.name === "calendar_delete_event")!;
    conflictTool = tools.find((t) => t.name === "calendar_find_conflict")!;
    generateTool = tools.find((t) => t.name === "calendar_generate_events_from_prompt")!;
  });

  it("registers the 6 P4.1 tools with the expected names", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        "calendar_create_event",
        "calendar_delete_event",
        "calendar_find_conflict",
        "calendar_generate_events_from_prompt",
        "calendar_list",
        "calendar_update_event",
      ].sort(),
    );
  });

  it("marks destructive ops as user-confirm", () => {
    expect(createTool.permissionLevel).toBe("user-confirm");
    expect(deleteTool.permissionLevel).toBe("user-confirm");
    // Read-only / non-destructive default to auto.
    expect(listTool.permissionLevel).toBe("auto");
    expect(updateTool.permissionLevel).toBe("auto");
    expect(conflictTool.permissionLevel).toBe("auto");
    expect(generateTool.permissionLevel).toBe("auto");
  });

  describe("calendar_list", () => {
    it("defaults to today's [00:00, 23:59] window when no range given", async () => {
      const events = [makeEvent()];
      eventService.getAll.mockReturnValue(Promise.resolve(events));

      const result = (await listTool.execute({})) as { count: number; events: CalendarEvent[] };
      expect(result.count).toBe(1);
      expect(eventService.getAll).toHaveBeenCalledTimes(1);
      const args = eventService.getAll.mock.calls[0][0] as { from: Date; to: Date };
      expect(args.from.getHours()).toBe(0);
      expect(args.to.getHours()).toBe(23);
    });

    it("forwards explicit YYYY-MM-DD range", async () => {
      await listTool.execute({ from: "2026-04-01", to: "2026-04-07" });
      const args = eventService.getAll.mock.calls[0][0] as { from: Date; to: Date };
      // Date-only strings are parsed as local time, so we assert via local accessors.
      expect(args.from.getFullYear()).toBe(2026);
      expect(args.from.getMonth()).toBe(3); // April (0-indexed)
      expect(args.from.getDate()).toBe(1);
      expect(args.from.getHours()).toBe(0);
      expect(args.to.getDate()).toBe(7);
      expect(args.to.getHours()).toBe(23);
      expect(args.to.getMinutes()).toBe(59);
    });

    it("resolves calendarName to a calendarId", async () => {
      calendarService.getAll.mockReturnValue(Promise.resolve([
        makeCalendar({ id: "cal-work", name: "Work" }),
        makeCalendar({ id: "cal-perso", name: "Personal" }),
      ]));

      await listTool.execute({ calendarName: "personal" }); // case-insensitive
      const args = eventService.getAll.mock.calls[0][0] as { calendarId?: string };
      expect(args.calendarId).toBe("cal-perso");
    });

    it("returns a structured error when calendarName is unknown", async () => {
      calendarService.getAll.mockReturnValue(Promise.resolve([makeCalendar({ name: "Work" })]));
      const result = (await listTool.execute({ calendarName: "nope" })) as { error?: string; available?: string[] };
      expect(result.error).toContain("Calendrier introuvable");
      expect(result.available).toEqual(["Work"]);
      expect(eventService.getAll).not.toHaveBeenCalled();
    });

    it("rejects malformed date input via zod", async () => {
      const result = (await listTool.execute({ from: "not-a-date" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(eventService.getAll).not.toHaveBeenCalled();
    });
  });

  describe("calendar_create_event", () => {
    it("forwards required fields and returns the created event", async () => {
      const event = makeEvent({ title: "Demo", id: "evt-new" });
      eventService.create.mockReturnValue(Promise.resolve(event));

      const result = (await createTool.execute({
        calendarId: "cal-1",
        title: "Demo",
        startAt: "2026-04-28T09:00:00Z",
        endAt: "2026-04-28T10:00:00Z",
      })) as { created: boolean; event: CalendarEvent };

      expect(result.created).toBe(true);
      expect(result.event.id).toBe("evt-new");
      const [input, reminders] = eventService.create.mock.calls[0];
      expect((input as { calendarId: string }).calendarId).toBe("cal-1");
      expect((input as { title: string }).title).toBe("Demo");
      expect(reminders).toBeUndefined();
    });

    it("passes reminderMinutesBefore through as a reminders array", async () => {
      await createTool.execute({
        calendarId: "cal-1",
        title: "Standup",
        startAt: "2026-04-28T09:00:00Z",
        endAt: "2026-04-28T09:15:00Z",
        reminderMinutesBefore: [10, 60],
      });
      const [, reminders] = eventService.create.mock.calls[0];
      expect(reminders).toEqual([{ minutesBefore: 10 }, { minutesBefore: 60 }]);
    });

    it("rejects endAt < startAt", async () => {
      const result = (await createTool.execute({
        calendarId: "cal-1",
        title: "Bad",
        startAt: "2026-04-28T10:00:00Z",
        endAt: "2026-04-28T09:00:00Z",
      })) as { error?: string };
      expect(result.error).toContain(">= startAt");
      expect(eventService.create).not.toHaveBeenCalled();
    });

    it("rejects missing required fields via zod", async () => {
      const result = (await createTool.execute({ calendarId: "cal-1" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(eventService.create).not.toHaveBeenCalled();
    });
  });

  describe("calendar_update_event", () => {
    it("only forwards fields that were provided", async () => {
      const event = makeEvent({ title: "Renamed" });
      eventService.update.mockReturnValue(Promise.resolve(event));

      const result = (await updateTool.execute({ id: "evt-1", title: "Renamed" })) as { updated: boolean };
      expect(result.updated).toBe(true);
      const [id, input] = eventService.update.mock.calls[0];
      expect(id).toBe("evt-1");
      // Only `title` should be present — never spread undefined into update.
      expect(Object.keys(input as object)).toEqual(["title"]);
    });

    it("returns a not-found error when service returns null", async () => {
      eventService.update.mockReturnValue(Promise.resolve(null));
      const result = (await updateTool.execute({ id: "ghost", title: "X" })) as { error?: string };
      expect(result.error).toContain("Evenement introuvable");
    });

    it("rejects endAt earlier than startAt", async () => {
      const result = (await updateTool.execute({
        id: "evt-1",
        startAt: "2026-04-28T10:00:00Z",
        endAt: "2026-04-28T09:00:00Z",
      })) as { error?: string };
      expect(result.error).toContain(">= startAt");
      expect(eventService.update).not.toHaveBeenCalled();
    });
  });

  describe("calendar_delete_event", () => {
    it("returns deleted=true when service confirms", async () => {
      eventService.delete.mockReturnValue(Promise.resolve(true));
      const result = (await deleteTool.execute({ id: "evt-1" })) as { deleted: boolean };
      expect(result.deleted).toBe(true);
      expect(eventService.delete).toHaveBeenCalledWith("evt-1");
    });

    it("returns a not-found error when service returns false", async () => {
      eventService.delete.mockReturnValue(Promise.resolve(false));
      const result = (await deleteTool.execute({ id: "missing" })) as { error?: string };
      expect(result.error).toContain("Evenement introuvable");
    });
  });

  describe("calendar_find_conflict", () => {
    it("flags overlap with at least one event", async () => {
      eventService.getAll.mockReturnValue(Promise.resolve([
        makeEvent({ id: "e1", startAt: new Date("2026-04-28T09:30:00Z"), endAt: new Date("2026-04-28T10:30:00Z") }),
      ]));
      const result = (await conflictTool.execute({
        startAt: "2026-04-28T09:00:00Z",
        endAt: "2026-04-28T10:00:00Z",
      })) as { hasConflict: boolean; count: number };
      expect(result.hasConflict).toBe(true);
      expect(result.count).toBe(1);
    });

    it("treats touching boundaries as non-conflicting", async () => {
      eventService.getAll.mockReturnValue(Promise.resolve([
        makeEvent({ id: "e1", startAt: new Date("2026-04-28T10:00:00Z"), endAt: new Date("2026-04-28T11:00:00Z") }),
      ]));
      const result = (await conflictTool.execute({
        startAt: "2026-04-28T09:00:00Z",
        endAt: "2026-04-28T10:00:00Z",
      })) as { hasConflict: boolean };
      expect(result.hasConflict).toBe(false);
    });

    it("returns no conflict when calendar is empty", async () => {
      eventService.getAll.mockReturnValue(Promise.resolve([]));
      const result = (await conflictTool.execute({
        startAt: "2026-04-28T09:00:00Z",
        endAt: "2026-04-28T10:00:00Z",
      })) as { hasConflict: boolean; count: number };
      expect(result.hasConflict).toBe(false);
      expect(result.count).toBe(0);
    });
  });

  describe("calendar_generate_events_from_prompt", () => {
    it("delegates to llmService.generateEvents and returns the count", async () => {
      llmService.generateEvents.mockReturnValue(Promise.resolve([
        { title: "A", startAt: "2026-04-28T09:00:00Z", endAt: "2026-04-28T10:00:00Z", description: null, location: null, isAllDay: false },
        { title: "B", startAt: "2026-04-28T14:00:00Z", endAt: "2026-04-28T15:00:00Z", description: null, location: null, isAllDay: false },
      ]));
      const result = (await generateTool.execute({ prompt: "demain matin meeting puis sport" })) as { count: number; events: unknown[] };
      expect(result.count).toBe(2);
      expect(llmService.generateEvents).toHaveBeenCalledTimes(1);
    });

    it("uses today's date when none is provided", async () => {
      await generateTool.execute({ prompt: "lunch" });
      const [, refDate] = llmService.generateEvents.mock.calls[0];
      // "today" in ISO date is YYYY-MM-DD shape.
      expect(refDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns a structured error when llmService is not wired", () => {
      const toolsNoLlm = createCalendarTools(
        eventService as unknown as EventService,
        calendarService as unknown as CalendarService,
        undefined,
      );
      const tool = toolsNoLlm.find((t) => t.name === "calendar_generate_events_from_prompt")!;
      return tool.execute({ prompt: "x" }).then((result) => {
        expect((result as { error?: string }).error).toContain("LLM non configure");
      });
    });

    it("rejects bad date format", async () => {
      const result = (await generateTool.execute({ prompt: "x", date: "28/04/2026" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(llmService.generateEvents).not.toHaveBeenCalled();
    });
  });
});
