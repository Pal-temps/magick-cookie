import { z } from "zod";

export const createSnippetSchema = z.object({
  title: z.string().max(255).min(1),
  content: z.string().min(1),
  language: z.string().max(50).optional(),
  category: z.string().max(30).optional(),
  isFavorite: z.boolean().optional(),
});

export const updateSnippetSchema = z.object({
  title: z.string().max(255).min(1).optional(),
  content: z.string().min(1).optional(),
  language: z.string().max(50).optional(),
  category: z.string().max(30).optional(),
  isFavorite: z.boolean().optional(),
});

export const createSnippetCategorySchema = z.object({
  value: z.string().max(30).min(1),
  label: z.string().max(100).min(1),
  sortOrder: z.number().int().optional(),
});

export const updateSnippetCategorySchema = z.object({
  label: z.string().max(100).min(1).optional(),
  sortOrder: z.number().int().optional(),
});
