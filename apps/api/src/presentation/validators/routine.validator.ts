import { z } from "zod";

const routineStepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("navigate"), view: z.string().min(1) }),
  z.object({ action: z.literal("sync"), target: z.enum(["email", "rss", "github"]) }),
  z.object({ action: z.literal("generate"), target: z.enum(["brief", "changelog"]) }),
  z.object({ action: z.literal("notify"), title: z.string().min(1).max(255), body: z.string().min(1) }),
]);

export const createRoutineSchema = z.object({
  name: z.string().min(1).max(255),
  triggerTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  triggerDays: z.array(z.number().int().min(0).max(6)).optional(),
  steps: z.array(routineStepSchema).optional(),
  enabled: z.boolean().optional(),
});

export const updateRoutineSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  triggerTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format").optional(),
  triggerDays: z.array(z.number().int().min(0).max(6)).optional(),
  steps: z.array(routineStepSchema).optional(),
  enabled: z.boolean().optional(),
});
