import { z } from "zod";

export const updateLlmConfigSchema = z.object({
  provider: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().nullable().optional(),
  maxTokens: z.number().int().min(1).max(32768).optional(),
  temperature: z.number().min(0).max(2).optional(),
  enabled: z.boolean().optional(),
});

export const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })).min(1),
});
