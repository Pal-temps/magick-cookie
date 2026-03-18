import { z } from "zod";

export const createCalDavAccountSchema = z.object({
  label: z.string().min(1).max(255),
  url: z.string().url().max(1000),
  username: z.string().min(1).max(255),
  password: z.string().min(1),
  calendarId: z.string().uuid().optional(),
});

export const updateCalDavAccountSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  url: z.string().url().max(1000).optional(),
  username: z.string().min(1).max(255).optional(),
  password: z.string().min(1).optional(),
  calendarId: z.string().uuid().optional(),
  syncEnabled: z.boolean().optional(),
});
