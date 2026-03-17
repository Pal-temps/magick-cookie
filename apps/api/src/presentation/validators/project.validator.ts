import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  color: z.string().max(7).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z.string().max(7).optional(),
});
