import type { EmailRule, CreateEmailRuleInput, UpdateEmailRuleInput } from "./email-rule.entity";

export interface EmailRuleRepository {
  findAll(): Promise<EmailRule[]>;
  findById(id: string): Promise<EmailRule | null>;
  findEnabled(): Promise<EmailRule[]>;
  create(input: CreateEmailRuleInput): Promise<EmailRule>;
  update(id: string, input: UpdateEmailRuleInput): Promise<EmailRule | null>;
  delete(id: string): Promise<boolean>;
}
