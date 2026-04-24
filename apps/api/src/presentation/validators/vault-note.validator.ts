import { z } from "zod";

// Paths must be relative, forward-slash, end in `.md`. Path traversal is blocked at the repo layer
// (VaultService.resolvePath) but we reject obvious cases here for a cleaner 400.
const notePathSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[^\0]+$/, "path contains null byte")
  .refine((p) => !p.includes(".."), { message: "path traversal (..) forbidden" })
  .refine((p) => p.replace(/\\/g, "/").endsWith(".md"), { message: "path must end with .md" });

const frontmatterSchema = z.record(z.string(), z.unknown());

export const listNotesQuerySchema = z.object({
  prefix: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const createNoteSchema = z.object({
  path: notePathSchema,
  body: z.string().max(1_000_000),
  frontmatter: frontmatterSchema.optional(),
});

export const updateNoteSchema = z.object({
  body: z.string().max(1_000_000).optional(),
  frontmatter: frontmatterSchema.optional(),
}).refine((v) => v.body !== undefined || v.frontmatter !== undefined, {
  message: "body or frontmatter must be provided",
});

export const appendNoteSchema = z.object({
  text: z.string().min(1).max(1_000_000),
});

export const renameNoteSchema = z.object({
  newPath: notePathSchema,
});
