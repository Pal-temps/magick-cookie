import { z } from "zod";

export const createDogWalkSchema = z.object({
  notes: z.string().max(500).nullable().optional(),
});

export const dogWalkQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
