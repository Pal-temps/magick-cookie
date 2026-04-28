import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createAlarmTools } from "../../application/agent/tools/alarm.tools";
import type { AlarmService } from "../../application/alarm/alarm.service";
import type { Alarm } from "../../domain/alarm/alarm.entity";
import type { AgentTool } from "../../application/agent/tool-registry";

const makeAlarm = (overrides: Partial<Alarm> = {}): Alarm => ({
  id: "al-1",
  time: "07:30",
  label: "Wake up",
  repeatPattern: "weekdays",
  repeatDays: null,
  enabled: true,
  alertSound: null,
  lastFiredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("alarm.tools", () => {
  let svc: { [K in keyof AlarmService]: ReturnType<typeof mock> };
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
      create: mock(() => Promise.resolve(makeAlarm())),
      update: mock(() => Promise.resolve(makeAlarm())),
      delete: mock(() => Promise.resolve(true)),
      markFired: mock(() => Promise.resolve()),
    } as unknown as { [K in keyof AlarmService]: ReturnType<typeof mock> };

    tools = createAlarmTools(svc as unknown as AlarmService);
    listTool = tools.find((t) => t.name === "alarm_list")!;
    createTool = tools.find((t) => t.name === "alarm_create")!;
    updateTool = tools.find((t) => t.name === "alarm_update")!;
    deleteTool = tools.find((t) => t.name === "alarm_delete")!;
  });

  it("registers the 4 alarm tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(["alarm_create", "alarm_delete", "alarm_list", "alarm_update"]);
  });

  it("only alarm_delete is user-confirm", () => {
    expect(deleteTool.permissionLevel).toBe("user-confirm");
    expect(listTool.permissionLevel).toBe("auto");
    expect(createTool.permissionLevel).toBe("auto");
    expect(updateTool.permissionLevel).toBe("auto");
  });

  describe("alarm_list", () => {
    it("calls getAll by default", async () => {
      await listTool.execute({});
      expect(svc.getAll).toHaveBeenCalledTimes(1);
      expect(svc.getEnabled).not.toHaveBeenCalled();
    });

    it("calls getEnabled when enabledOnly=true", async () => {
      await listTool.execute({ enabledOnly: true });
      expect(svc.getEnabled).toHaveBeenCalledTimes(1);
      expect(svc.getAll).not.toHaveBeenCalled();
    });
  });

  describe("alarm_create", () => {
    it("forwards required fields with default null alertSound", async () => {
      await createTool.execute({ time: "08:00", label: "Sport" });
      const arg = svc.create.mock.calls[0][0] as { time: string; label: string; alertSound: string | null };
      expect(arg.time).toBe("08:00");
      expect(arg.label).toBe("Sport");
      expect(arg.alertSound).toBeNull();
    });

    it("rejects malformed HH:MM via zod", async () => {
      const result = (await createTool.execute({ time: "8h00", label: "X" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.create).not.toHaveBeenCalled();
    });

    it("rejects unknown repeatPattern", async () => {
      const result = (await createTool.execute({ time: "08:00", label: "X", repeatPattern: "monthly" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });

    it("rejects out-of-range repeatDays", async () => {
      const result = (await createTool.execute({ time: "08:00", label: "X", repeatPattern: "custom", repeatDays: [7] })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("alarm_update", () => {
    it("only forwards fields actually provided", async () => {
      svc.update.mockReturnValue(Promise.resolve(makeAlarm({ enabled: false })));
      await updateTool.execute({ id: "al-1", enabled: false });
      const [id, input] = svc.update.mock.calls[0];
      expect(id).toBe("al-1");
      expect(Object.keys(input as object)).toEqual(["enabled"]);
    });

    it("returns a not-found error when service returns null", async () => {
      svc.update.mockReturnValue(Promise.resolve(null));
      const result = (await updateTool.execute({ id: "ghost", enabled: true })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });
  });

  describe("alarm_delete", () => {
    it("delegates and returns the id", async () => {
      const result = (await deleteTool.execute({ id: "al-1" })) as { deleted: boolean; id: string };
      expect(result.deleted).toBe(true);
      expect(result.id).toBe("al-1");
    });
  });
});
