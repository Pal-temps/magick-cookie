import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createTimerTools } from "../../application/agent/tools/timer.tools";
import type { TimerSessionService } from "../../application/timer-session/timer-session.service";
import type { AgentTool } from "../../application/agent/tool-registry";

describe("timer.tools", () => {
  let svc: { [K in keyof TimerSessionService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let todayTool: AgentTool;
  let listTool: AgentTool;
  let saveTool: AgentTool;

  beforeEach(() => {
    svc = {
      getAll: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve({} as never)),
      getTodayStats: mock(() => Promise.resolve({ totalSeconds: 0, sessionCount: 0 })),
      getDailyStats: mock(() => Promise.resolve([] as never)),
    } as unknown as { [K in keyof TimerSessionService]: ReturnType<typeof mock> };

    tools = createTimerTools(svc as unknown as TimerSessionService);
    todayTool = tools.find((t) => t.name === "get_today_timer_stats")!;
    listTool = tools.find((t) => t.name === "get_timer_sessions")!;
    saveTool = tools.find((t) => t.name === "save_timer_session")!;
  });

  it("registers 3 tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_timer_sessions",
      "get_today_timer_stats",
      "save_timer_session",
    ]);
  });

  it("get_today_timer_stats delegates with no args", async () => {
    await todayTool.execute({});
    expect(svc.getTodayStats).toHaveBeenCalledTimes(1);
  });

  it("get_timer_sessions caps the result to the first 20 sessions", async () => {
    const long = Array.from({ length: 50 }, (_, i) => ({ id: `s${i}` }));
    svc.getAll.mockReturnValue(Promise.resolve(long as never));
    const result = (await listTool.execute({ from: "2026-04-01", to: "2026-04-30" })) as unknown[];
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(20);
  });

  it("get_timer_sessions rejects malformed date", async () => {
    const result = (await listTool.execute({ from: "yesterday", to: "today" })) as { error?: string };
    expect(result.error).toBe("Parametres invalides");
    expect(svc.getAll).not.toHaveBeenCalled();
  });

  it("save_timer_session computes startedAt from actualSeconds and defaults completed=true", async () => {
    const before = Date.now();
    await saveTool.execute({ mode: "pomodoro", durationMinutes: 25, actualSeconds: 1500 });
    const after = Date.now();
    expect(svc.create).toHaveBeenCalledTimes(1);
    const arg = svc.create.mock.calls[0][0] as {
      mode: string; durationMinutes: number; actualSeconds: number;
      startedAt: Date; endedAt: Date; completed: boolean;
      label: string | null; projectId: string | null; taskId: string | null;
    };
    expect(arg.mode).toBe("pomodoro");
    expect(arg.completed).toBe(true);
    expect(arg.label).toBeNull();
    expect(arg.projectId).toBeNull();
    expect(arg.taskId).toBeNull();
    // endedAt should be ~now and startedAt = endedAt - 1500s.
    expect(arg.endedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(arg.endedAt.getTime()).toBeLessThanOrEqual(after);
    expect(arg.endedAt.getTime() - arg.startedAt.getTime()).toBe(1500 * 1000);
  });

  it("save_timer_session forwards optional fields", async () => {
    await saveTool.execute({
      mode: "free", durationMinutes: 0, actualSeconds: 600,
      completed: false, label: "deep work", projectId: "proj-1", taskId: "task-1",
    });
    const arg = svc.create.mock.calls[0][0] as { completed: boolean; label: string | null; projectId: string | null };
    expect(arg.completed).toBe(false);
    expect(arg.label).toBe("deep work");
    expect(arg.projectId).toBe("proj-1");
  });

  it("save_timer_session rejects negative actualSeconds", async () => {
    const result = (await saveTool.execute({ mode: "pomodoro", durationMinutes: 25, actualSeconds: -1 })) as { error?: string };
    expect(result.error).toBe("Parametres invalides");
    expect(svc.create).not.toHaveBeenCalled();
  });
});
