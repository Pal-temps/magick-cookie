import { z } from "zod";

export const createEmailAccountSchema = z.object({
  label: z.string().min(1).max(255),
  email: z.string().email(),
  imapHost: z.string().min(1),
  imapPort: z.number().int().min(1).max(65535).default(993),
  imapSecure: z.boolean().default(true),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpSecure: z.boolean().default(false),
  username: z.string().min(1),
  password: z.string().min(1),
  selfSigned: z.boolean().default(false),
});

export const sendEmailSchema = z.object({
  accountId: z.string().uuid(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  subject: z.string().max(1000),
  bodyText: z.string().min(1),
  bodyHtml: z.string().optional(),
});

export const updateEmailAccountSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  syncEnabled: z.boolean().optional(),
});

export const updateEmailFlagsSchema = z.object({
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const emailQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  folder: z.string().max(255).optional(),
  unread: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
