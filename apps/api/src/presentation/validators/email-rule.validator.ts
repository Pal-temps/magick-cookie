import { z } from "zod";

const conditionFields = ["from", "subject", "domain"] as const;
const conditionOperators = ["contains", "equals", "startsWith", "endsWith"] as const;
const actionTypes = ["classify", "star", "archive"] as const;

export const createEmailRuleSchema = z.object({
  name: z.string().min(1).max(255),
  conditionField: z.enum(conditionFields),
  conditionOperator: z.enum(conditionOperators),
  conditionValue: z.string().min(1).max(500),
  actionType: z.enum(actionTypes),
  actionValue: z.string().min(1).max(100),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateEmailRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  conditionField: z.enum(conditionFields).optional(),
  conditionOperator: z.enum(conditionOperators).optional(),
  conditionValue: z.string().min(1).max(500).optional(),
  actionType: z.enum(actionTypes).optional(),
  actionValue: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
