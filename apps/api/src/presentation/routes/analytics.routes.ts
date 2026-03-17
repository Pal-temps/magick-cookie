import { Hono } from "hono";
import type { AnalyticsService } from "../../application/analytics/analytics.service";
import { analyticsQuerySchema, weeklyReviewQuerySchema } from "../validators/analytics.validator";

export function createAnalyticsRoutes(analyticsService: AnalyticsService) {
  const app = new Hono();

  // GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get("/", async (c) => {
    const { from, to } = analyticsQuerySchema.parse(c.req.query());
    const data = await analyticsService.getOverview(new Date(from), new Date(to + "T23:59:59"));
    return c.json({ data });
  });

  // GET /api/analytics/streak
  app.get("/streak", async (c) => {
    const data = await analyticsService.getStreak();
    return c.json({ data });
  });

  // GET /api/analytics/weekly-review?week=2026-W12
  app.get("/weekly-review", async (c) => {
    const { week } = weeklyReviewQuerySchema.parse(c.req.query());
    const data = await analyticsService.getWeeklyReview(week);
    return c.json({ data });
  });

  // GET /api/analytics/timesheet?week=2026-W12
  app.get("/timesheet", async (c) => {
    const week = c.req.query("week");
    if (!week) return c.json({ error: "week required (YYYY-WNN)" }, 400);
    const data = await analyticsService.getTimesheet(week);
    return c.json({ data });
  });

  // GET /api/analytics/time-by-task?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get("/time-by-task", async (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    if (!from || !to) return c.json({ error: "from and to required" }, 400);
    const data = await analyticsService.getTimeByTask(new Date(from), new Date(to + "T23:59:59"));
    return c.json({ data });
  });

  // GET /api/analytics/patterns?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get("/patterns", async (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    if (!from || !to) return c.json({ error: "from and to required" }, 400);
    const data = await analyticsService.getProductivityPatterns(new Date(from), new Date(to + "T23:59:59"));
    return c.json({ data });
  });

  return app;
}
