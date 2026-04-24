import { z } from "zod";

export const createAlarmSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  label: z.string().min(1).max(255),
  repeatPattern: z.enum(["once", "daily", "weekdays", "weekends", "custom"]).optional(),
  repeatDays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  enabled: z.boolean().optional(),
  alertSound: z.string().max(50).nullable().optional(),
});

export const updateAlarmSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format").optional(),
  label: z.string().min(1).max(255).optional(),
  repeatPattern: z.enum(["once", "daily", "weekdays", "weekends", "custom"]).optional(),
  repeatDays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  enabled: z.boolean().optional(),
  alertSound: z.string().max(50).nullable().optional(),
});
