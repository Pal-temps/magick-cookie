import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createRoutineTools } from "../../application/agent/tools/routine.tools";
import type { RoutineService } from "../../application/routine/routine.service";
import type { Routine } from "../../domain/routine/routine.entity";
import type { AgentTool } from "../../application/agent/tool-registry";

const makeRoutine = (overrides: Partial<Routine> = {}): Routine => ({
  id: "rt-1",
  name: "Morning brief",
  triggerTime: "07:00",
  triggerDays: [1, 2, 3, 4, 5],
  steps: [{ action: "generate", target: "brief" }],
  enabled: true,
  lastRunAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("routine.tools", () => {
  let svc: { [K in keyof RoutineService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let listTool: AgentTool;
  let createTool: AgentTool;
  let updateTool: AgentTool;
  let deleteTool: AgentTool;

  beforeEach(() => {
    svc = {
      getAll: mock(() => Promise.resolve([])),
      getById: mock(() => Promise.resolve(null)),
      getEnabled: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve(makeRoutine())),
      update: mock(() => Promise.resolve(makeRoutine())),
      delete: mock(() => Promise.resolve(true)),
      markRun: mock(() => Promise.resolve()),
    } as unknown as { [K in keyof RoutineService]: ReturnType<typeof mock> };

    tools = createRoutineTools(svc as unknown as RoutineService);
    listTool = tools.find((t) => t.name === "routine_list")!;
    createTool = tools.find((t) => t.name === "routine_create")!;
    updateTool = tools.find((t) => t.name === "routine_update")!;
    deleteTool = tools.find((t) => t.name === "routine_delete")!;
  });

  it("registers the 4 routine tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(["routine_create", "routine_delete", "routine_list", "routine_update"]);
  });

  it("only routine_delete is user-confirm", () => {
    expect(deleteTool.permissionLevel).toBe("user-confirm");
    expect(listTool.permissionLevel).toBe("auto");
    expect(createTool.permissionLevel).toBe("auto");
    expect(updateTool.permissionLevel).toBe("auto");
  });

  describe("routine_list", () => {
    it("calls getEnabled when enabledOnly=true", async () => {
      await listTool.execute({ enabledOnly: true });
      expect(svc.getEnabled).toHaveBeenCalledTimes(1);
      expect(svc.getAll).not.toHaveBeenCalled();
    });

    it("calls getAll by default", async () => {
      await listTool.execute({});
      expect(svc.getAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("routine_create", () => {
    it("accepts a navigate step", async () => {
      await createTool.execute({
        name: "Open inbox", triggerTime: "07:00",
        steps: [{ action: "navigate", view: "email" }],
      });
      expect(svc.create).toHaveBeenCalledTimes(1);
    });

    it("accepts a notify step with title and body", async () => {
      await createTool.execute({
        name: "Reminder", triggerTime: "08:00",
        steps: [{ action: "notify", title: "Hey", body: "Stand up" }],
      });
      expect(svc.create).toHaveBeenCalledTimes(1);
    });

    it("rejects an invalid sync target via discriminated union", async () => {
      const result = (await createTool.execute({
        name: "Bad", triggerTime: "08:00",
        steps: [{ action: "sync", target: "calendar" }],
      })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.create).not.toHaveBeenCalled();
    });

    it("rejects unknown step action", async () => {
      const result = (await createTool.execute({
        name: "Bad", triggerTime: "08:00",
        steps: [{ action: "delete-everything" }] as never,
      })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });

    it("rejects HH:MM format violation", async () => {
      const result = (await createTool.execute({ name: "X", triggerTime: "25:00" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });

    it("caps steps at 20 entries", async () => {
      const steps = Array.from({ length: 21 }, () => ({ action: "navigate" as const, view: "email" }));
      const result = (await createTool.execute({ name: "Too many", triggerTime: "08:00", steps })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("routine_update", () => {
    it("only forwards fields actually provided", async () => {
      svc.update.mockReturnValue(Promise.resolve(makeRoutine({ enabled: false })));
      await updateTool.execute({ id: "rt-1", enabled: false });
      const [id, input] = svc.update.mock.calls[0];
      expect(id).toBe("rt-1");
      expect(Object.keys(input as object)).toEqual(["enabled"]);
    });

    it("returns a not-found error when service returns null", async () => {
      svc.update.mockReturnValue(Promise.resolve(null));
      const result = (await updateTool.execute({ id: "ghost", enabled: true })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });

    it("supports replacing steps wholesale", async () => {
      await updateTool.execute({
        id: "rt-1",
        steps: [{ action: "generate", target: "rss-digest" }],
      });
      const [, input] = svc.update.mock.calls[0];
      expect((input as { steps: { action: string }[] }).steps).toHaveLength(1);
    });
  });

  describe("routine_delete", () => {
    it("delegates and returns the id", async () => {
      const result = (await deleteTool.execute({ id: "rt-1" })) as { deleted: boolean; id: string };
      expect(result.deleted).toBe(true);
    });
  });
});
