import { z } from "zod";
import { paginationSchema } from "./shared.validator";

export const taskQuerySchema = paginationSchema.extend({
  source: z.string().optional(),
});

// Dates can be ISO strings or null (explicit unset). Length caps prevent abusive payloads.
const isoDateOrNull = z.union([z.string().datetime(), z.string().date(), z.null()]);

export const taskUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.union([z.string().max(10_000), z.null()]).optional(),
  status: z.string().min(1).max(50).optional(),
  priority: z.union([z.string().min(1).max(50), z.null()]).optional(),
  startDate: isoDateOrNull.optional(),
  dueDate: isoDateOrNull.optional(),
}).strict();
