import { z } from "zod";

export const wellnessLogDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const incrementWellnessLogSchema = z.object({
  type: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().int(),
});

export const wellnessLogRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.string().min(1).max(50).optional(),
});

export const setGoalSchema = z.object({
  type: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goal: z.number().int().min(1),
});
