import type { EmailRuleRepository } from "../../domain/email/email-rule.repository";
import type { EmailRule, CreateEmailRuleInput, UpdateEmailRuleInput } from "../../domain/email/email-rule.entity";
import type { Email } from "../../domain/email/email.entity";

export interface RuleApplicationResult {
  classification?: string;
  isStarred?: boolean;
  isArchived?: boolean;
}

export class EmailRuleService {
  constructor(private ruleRepo: EmailRuleRepository) {}

  // --- CRUD ---

  async getRules(): Promise<EmailRule[]> {
    return this.ruleRepo.findAll();
  }

  async getRuleById(id: string): Promise<EmailRule | null> {
    return this.ruleRepo.findById(id);
  }

  async createRule(input: CreateEmailRuleInput): Promise<EmailRule> {
    return this.ruleRepo.create(input);
  }

  async updateRule(id: string, input: UpdateEmailRuleInput): Promise<EmailRule | null> {
    return this.ruleRepo.update(id, input);
  }

  async deleteRule(id: string): Promise<boolean> {
    return this.ruleRepo.delete(id);
  }

  // --- Rule application ---

  async applyRules(email: Email): Promise<RuleApplicationResult> {
    const rules = await this.ruleRepo.findEnabled();
    const result: RuleApplicationResult = {};

    for (const rule of rules) {
      if (this.matchesRule(email, rule)) {
        switch (rule.actionType) {
          case "classify":
            result.classification = rule.actionValue;
            break;
          case "star":
            result.isStarred = rule.actionValue === "true";
            break;
          case "archive":
            result.isArchived = rule.actionValue === "true";
            break;
        }
      }
    }

    return result;
  }

  private matchesRule(email: Email, rule: EmailRule): boolean {
    let fieldValue = "";

    switch (rule.conditionField) {
      case "from":
        fieldValue = email.fromAddress;
        break;
      case "subject":
        fieldValue = email.subject || "";
        break;
      case "domain":
        fieldValue = email.fromAddress.split("@")[1] || "";
        break;
    }

    const value = fieldValue.toLowerCase();
    const condition = rule.conditionValue.toLowerCase();

    switch (rule.conditionOperator) {
      case "contains":
        return value.includes(condition);
      case "equals":
        return value === condition;
      case "startsWith":
        return value.startsWith(condition);
      case "endsWith":
        return value.endsWith(condition);
      default:
        return false;
    }
  }
}
