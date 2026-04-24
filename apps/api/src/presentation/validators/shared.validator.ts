import { z } from "zod";

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const uuidSchema = z.string().uuid();

export const idParamSchema = z.object({ id: uuidSchema });

// "Safe identifier": alphanumeric + _- and must not start with -. Used whenever a name is going
// to be composed into a shell command, a filesystem path, or a subprocess argument.
export const safeIdentifierSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "must match [a-zA-Z0-9][a-zA-Z0-9_-]*");

// Mask tokens/secrets in responses. Keep the last 4 chars for quick visual identification.
export function maskSecret(value: string | null | undefined, visible = 4): string {
  if (!value) return "";
  if (value.length <= visible) return "*".repeat(value.length);
  return "*".repeat(value.length - visible) + value.slice(-visible);
}
