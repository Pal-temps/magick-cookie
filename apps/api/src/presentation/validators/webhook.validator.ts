import { z } from "zod";

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(255),
  source: z.string().max(100).optional(),
});

export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  source: z.string().max(100).optional(),
  enabled: z.boolean().optional(),
});
