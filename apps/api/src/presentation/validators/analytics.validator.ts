import { z } from "zod";

export const analyticsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const weeklyReviewQuerySchema = z.object({
  week: z.string().regex(/^\d{4}-W\d{1,2}$/),
});
