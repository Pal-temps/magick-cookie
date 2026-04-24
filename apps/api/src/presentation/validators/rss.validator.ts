import { z } from "zod";
import { paginationSchema } from "./shared.validator";

export const createRssFeedSchema = z.object({
  label: z.string().min(1).max(255),
  url: z.string().url().max(1000),
  category: z.string().max(100).optional(),
});

export const updateRssFeedSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  url: z.string().url().max(1000).optional(),
  category: z.string().max(100).optional(),
  syncEnabled: z.boolean().optional(),
});

export const updateArticleFlagsSchema = z.object({
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
});

export const articleQuerySchema = paginationSchema.extend({
  feedId: z.string().uuid().optional(),
  unread: z.coerce.boolean().optional(),
  starred: z.coerce.boolean().optional(),
});
