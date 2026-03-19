import { z } from "zod";

export const userPreferencesSchema = z.object({
  version: z.literal(1),
  theme: z.object({
    theme: z.enum(["dark", "light", "cookie"]),
    mode: z.enum(["manual", "auto-system", "auto-schedule"]),
    schedule: z.object({
      darkStart: z.number().int().min(0).max(23),
      darkEnd: z.number().int().min(0).max(23),
    }),
  }),
  focus: z.object({
    enabled: z.boolean(),
  }),
  dashboard: z.object({
    widgetOrder: z.array(z.string().max(50)),
    hiddenWidgets: z.array(z.string().max(50)),
  }),
  shortcuts: z.object({
    custom: z.array(z.tuple([z.string().max(100), z.string().max(100)])),
  }),
  brief: z.object({
    customTemplates: z.array(z.object({
      id: z.string().max(100),
      name: z.string().max(255),
      prompt: z.string().max(5000),
    })),
    activeTemplateId: z.string().max(100),
  }),
  env: z.object({
    customChecks: z.array(z.object({
      name: z.string().max(255),
      url: z.string().max(1000),
    })),
  }),
  vps: z.object({
    notificationsEnabled: z.boolean(),
  }),
  sidebar: z.object({
    sectionOrder: z.array(z.string().max(50)),
  }),
});
