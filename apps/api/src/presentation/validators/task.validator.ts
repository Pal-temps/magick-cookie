import { z } from "zod";
import { paginationSchema } from "./shared.validator";

export const taskQuerySchema = paginationSchema.extend({
  source: z.string().optional(),
});
