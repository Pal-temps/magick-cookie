import { z } from "zod";

// Strip HTML tags and dangerous chars to prevent XSS in name/emoji
const sanitizedString = (maxLen: number) =>
  z.string().max(maxLen).transform((s) => s.replace(/<[^>]*>/g, "").replace(/[<>"'&]/g, ""));

// Only allow http/https URLs (block javascript:, data:, etc.)
const safeUrl = z.string().url().max(1000).refine(
  (url) => /^https?:\/\//i.test(url),
  { message: "Only http and https URLs are allowed" },
);

export const createBookmarkSchema = z.object({
  name: sanitizedString(255).pipe(z.string().min(1)),
  url: safeUrl,
  emoji: z.string().max(10).nullable().optional(),
  isFavorite: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateBookmarkSchema = z.object({
  name: sanitizedString(255).pipe(z.string().min(1)).optional(),
  url: safeUrl.optional(),
  emoji: z.string().max(10).nullable().optional(),
  isFavorite: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
