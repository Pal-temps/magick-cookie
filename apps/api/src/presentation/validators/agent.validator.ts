import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
});

export const sendMessageSchema = z.object({
  message: z.string().min(1).max(20_000),
});
