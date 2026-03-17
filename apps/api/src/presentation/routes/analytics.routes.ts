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

  // GET /api/analytics/weekly-review?week=2026-W12
  app.get("/weekly-review", async (c) => {
    const { week } = weeklyReviewQuerySchema.parse(c.req.query());
    const data = await analyticsService.getWeeklyReview(week);
    return c.json({ data });
  });

  return app;
}
