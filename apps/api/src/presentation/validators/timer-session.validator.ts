import { z } from "zod";

export const createTimerSessionSchema = z.object({
  mode: z.enum(["pomodoro", "free"]),
  durationMinutes: z.number().int().min(1),
  actualSeconds: z.number().int().min(0),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  completed: z.boolean().optional(),
  label: z.string().max(255).nullable().optional(),
  taskId: z.string().uuid().optional(),
});

export const timerSessionQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
