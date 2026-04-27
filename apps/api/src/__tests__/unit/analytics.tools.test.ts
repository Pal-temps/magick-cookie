import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createAnalyticsTools } from "../../application/agent/tools/analytics.tools";
import type { AnalyticsService } from "../../application/analytics/analytics.service";
import type { AgentTool } from "../../application/agent/tool-registry";

// Tool layer is just a thin facade over AnalyticsService — these tests assert the
// (1) zod date validation, (2) date conversion (YYYY-MM-DD → Date with end-of-day for `to`),
// (3) defaulting (today, current ISO week) where the tool fills it in.

describe("analytics.tools", () => {
  let svc: { [K in keyof AnalyticsService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let overview: AgentTool;
  let streak: AgentTool;
  let weekly: AgentTool;
  let patterns: AgentTool;
  let timeByProject: AgentTool;
  let today: AgentTool;

  beforeEach(() => {
    svc = {
      getOverview: mock(() => Promise.resolve({} as never)),
      getStreak: mock(() => Promise.resolve({} as never)),
      getWeeklyReview: mock(() => Promise.resolve({} as never)),
      getProductivityPatterns: mock(() => Promise.resolve({} as never)),
      getTimesheet: mock(() => Promise.resolve({} as never)),
      getTimeByTask: mock(() => Promise.resolve([] as never)),
      getTimeByProject: mock(() => Promise.resolve([] as never)),
    } as unknown as { [K in keyof AnalyticsService]: ReturnType<typeof mock> };

    tools = createAnalyticsTools(svc as unknown as AnalyticsService);
    overview = tools.find((t) => t.name === "get_productivity_overview")!;
    streak = tools.find((t) => t.name === "get_streak")!;
    weekly = tools.find((t) => t.name === "get_weekly_review")!;
    patterns = tools.find((t) => t.name === "get_productivity_patterns")!;
    timeByProject = tools.find((t) => t.name === "get_time_by_project")!;
    today = tools.find((t) => t.name === "get_today_stats")!;
  });

  it("registers the 6 analytics tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_productivity_overview",
      "get_productivity_patterns",
      "get_streak",
      "get_time_by_project",
      "get_today_stats",
      "get_weekly_review",
    ]);
  });

  it("get_productivity_overview converts dates and uses end-of-day for `to`", async () => {
    await overview.execute({ from: "2026-04-01", to: "2026-04-07" });
    const [from, to] = svc.getOverview.mock.calls[0];
    expect(from).toBeInstanceOf(Date);
    expect(to).toBeInstanceOf(Date);
    // `to` should be 23:59:59 — that's the only reason for the `${to}T23:59:59` template.
    expect((to as Date).getHours()).toBe(23);
    expect((to as Date).getMinutes()).toBe(59);
  });

  it("get_productivity_overview rejects malformed date", async () => {
    const result = (await overview.execute({ from: "01/04/2026", to: "2026-04-07" })) as { error?: string };
    expect(result.error).toBe("Parametres invalides");
    expect(svc.getOverview).not.toHaveBeenCalled();
  });

  it("get_streak takes no params", async () => {
    await streak.execute({});
    expect(svc.getStreak).toHaveBeenCalledTimes(1);
  });

  it("get_weekly_review forwards an explicit week", async () => {
    await weekly.execute({ week: "2026-W12" });
    expect(svc.getWeeklyReview).toHaveBeenCalledWith("2026-W12");
  });

  it("get_weekly_review defaults to the current ISO week when omitted", async () => {
    await weekly.execute({});
    const arg = svc.getWeeklyReview.mock.calls[0][0] as string;
    // We don't assert the exact week (test would break weekly) — just that it has the right shape.
    expect(arg).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("get_weekly_review rejects malformed week", async () => {
    const result = (await weekly.execute({ week: "2026/W12" })) as { error?: string };
    expect(result.error).toBe("Parametres invalides");
    expect(svc.getWeeklyReview).not.toHaveBeenCalled();
  });

  it("get_productivity_patterns delegates with end-of-day on `to`", async () => {
    await patterns.execute({ from: "2026-04-01", to: "2026-04-07" });
    const [, to] = svc.getProductivityPatterns.mock.calls[0];
    expect((to as Date).getHours()).toBe(23);
  });

  it("get_time_by_project delegates", async () => {
    await timeByProject.execute({ from: "2026-04-01", to: "2026-04-07" });
    expect(svc.getTimeByProject).toHaveBeenCalledTimes(1);
  });

  it("get_today_stats calls getOverview with a today-shaped window", async () => {
    await today.execute({});
    expect(svc.getOverview).toHaveBeenCalledTimes(1);
    const [from, to] = svc.getOverview.mock.calls[0];
    // Same calendar day on both ends.
    expect((from as Date).toDateString()).toBe((to as Date).toDateString());
  });
});
