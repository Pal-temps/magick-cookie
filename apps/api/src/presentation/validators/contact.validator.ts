import { z } from "zod";

export const createContactSchema = z.object({
  name: z.string().min(1).max(255),
  birthDate: z.coerce.date().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateContactSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  birthDate: z.coerce.date().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  notes: z.string().nullable().optional(),
});
