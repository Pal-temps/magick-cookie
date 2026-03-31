import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import { createAnalyticsRoutes } from "../../presentation/routes/analytics.routes";
import type { AnalyticsService } from "../../application/analytics/analytics.service";
import type { LlmService } from "../../application/llm/llm.service";

const fakeOverview = {
  period: { from: "2026-03-10", to: "2026-03-16" },
  focus: { totalSeconds: 5400, sessionCount: 6, completedCount: 5, dailyStats: [] },
  flux: { byStatus: { priority: 5, later: 3, archived: 2 }, totalFluxed: 10 },
  wellness: { waterAvg: 1750, fruitAvg: 5, daysTracked: 5 },
  email: { received: 25, unread: 8, dailyStats: [] },
  events: { total: 12, dailyStats: [] },
  dogWalk: { totalWalks: 2, totalSeconds: 1200, dailyStats: [] },
};

const fakeWeeklyReview = {
  week: "2026-W12",
  current: fakeOverview,
  previous: fakeOverview,
  deltas: {
    focusSeconds: 10,
    sessionCount: 0,
    totalFluxed: -5,
    emailReceived: 20,
    eventsTotal: null,
    dogWalks: 0,
  },
};

function makeMockAnalyticsService() {
  return {
    getWeeklyReview: mock(() => Promise.resolve({ ...fakeWeeklyReview })),
    getOverview: mock(() => Promise.resolve(fakeOverview)),
    getStreak: mock(() => Promise.resolve({ currentStreak: 3, longestStreak: 7 })),
    buildNarrativeData: mock(() => '{"semaine":"2026-W12"}'),
    getTimesheet: mock(() => Promise.resolve([])),
    getTimeByTask: mock(() => Promise.resolve([])),
    getTimeByProject: mock(() => Promise.resolve([])),
    getProductivityPatterns: mock(() => Promise.resolve({ hourlyDistribution: [], weekdayDistribution: [] })),
  } as unknown as AnalyticsService;
}

function makeMockLlmService() {
  return {
    generateNarrative: mock(() => Promise.resolve("Excellent travail cette semaine !")),
  } as unknown as LlmService;
}

describe("Analytics routes", () => {
  let analyticsService: ReturnType<typeof makeMockAnalyticsService>;

  beforeEach(() => {
    analyticsService = makeMockAnalyticsService();
  });

  describe("GET /weekly-review without narrative param", () => {
    it("should return weekly review data without calling LLM", async () => {
      const llmService = makeMockLlmService();
      const app = new Hono();
      app.route("/api/analytics", createAnalyticsRoutes(analyticsService as any, llmService as any));

      const res = await app.request("/api/analytics/weekly-review?week=2026-W12");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.week).toBe("2026-W12");
      expect(body.data.narrative).toBeUndefined();
      expect((llmService.generateNarrative as any).mock.calls).toHaveLength(0);
      expect((analyticsService.buildNarrativeData as any).mock.calls).toHaveLength(0);
    });
  });

  describe("GET /weekly-review with narrative=true", () => {
    it("should call LLM and include narrative in response", async () => {
      const llmService = makeMockLlmService();
      const app = new Hono();
      app.route("/api/analytics", createAnalyticsRoutes(analyticsService as any, llmService as any));

      const res = await app.request("/api/analytics/weekly-review?week=2026-W12&narrative=true");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.week).toBe("2026-W12");
      expect(body.data.narrative).toBe("Excellent travail cette semaine !");
      expect((analyticsService.buildNarrativeData as any).mock.calls).toHaveLength(1);
      expect((llmService.generateNarrative as any).mock.calls).toHaveLength(1);
    });
  });

  describe("GET /weekly-review with narrative=true but no llmService", () => {
    it("should return weekly review without narrative when llmService is absent", async () => {
      const app = new Hono();
      app.route("/api/analytics", createAnalyticsRoutes(analyticsService as any));

      const res = await app.request("/api/analytics/weekly-review?week=2026-W12&narrative=true");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.week).toBe("2026-W12");
      expect(body.data.narrative).toBeUndefined();
      expect((analyticsService.buildNarrativeData as any).mock.calls).toHaveLength(0);
    });
  });
});
