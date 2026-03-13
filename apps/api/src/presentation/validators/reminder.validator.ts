import { z } from "zod";

export const createReminderSchema = z.object({
  minutesBefore: z.number().int().min(0).default(15),
});
