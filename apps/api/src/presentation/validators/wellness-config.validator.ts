import { z } from "zod";

export const createWellnessConfigSchema = z.object({
  type: z.string().min(1).max(50),
  label: z.string().min(1).max(255),
  intervalMinutes: z.number().int().min(1),
  enabled: z.boolean().optional(),
});

export const updateWellnessConfigSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  intervalMinutes: z.number().int().min(1).optional(),
  enabled: z.boolean().optional(),
});
