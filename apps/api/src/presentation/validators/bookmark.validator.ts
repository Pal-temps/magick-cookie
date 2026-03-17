import { z } from "zod";

export const createBookmarkSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url().max(1000),
  emoji: z.string().max(10).nullable().optional(),
  isFavorite: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateBookmarkSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().max(1000).optional(),
  emoji: z.string().max(10).nullable().optional(),
  isFavorite: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
