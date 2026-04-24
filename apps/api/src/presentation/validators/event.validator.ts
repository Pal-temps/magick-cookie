import { z } from "zod";

const reminderSchema = z.object({
  minutesBefore: z.number().int().min(0),
});

export const createEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  isAllDay: z.boolean().optional(),
  recurrenceRule: z.string().max(500).nullable().optional(),
  reminders: z.array(reminderSchema).optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  isAllDay: z.boolean().optional(),
  recurrenceRule: z.string().max(500).nullable().optional(),
});

export const eventQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  calendarId: z.string().uuid().optional(),
});
