import { eq, asc } from "drizzle-orm";
import type { Database } from "../database/client";
import { emailRules } from "../database/schema";
import type { EmailRuleRepository } from "../../domain/email/email-rule.repository";
import type { EmailRule, CreateEmailRuleInput, UpdateEmailRuleInput } from "../../domain/email/email-rule.entity";

export class DrizzleEmailRuleRepository implements EmailRuleRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<EmailRule[]> {
    const rows = await this.db.select().from(emailRules).orderBy(asc(emailRules.sortOrder), asc(emailRules.createdAt));
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<EmailRule | null> {
    const rows = await this.db.select().from(emailRules).where(eq(emailRules.id, id)).limit(1);
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async findEnabled(): Promise<EmailRule[]> {
    const rows = await this.db.select().from(emailRules)
      .where(eq(emailRules.enabled, true))
      .orderBy(asc(emailRules.sortOrder), asc(emailRules.createdAt));
    return rows.map(this.toDomain);
  }

  async create(input: CreateEmailRuleInput): Promise<EmailRule> {
    const rows = await this.db.insert(emailRules).values({
      name: input.name,
      conditionField: input.conditionField,
      conditionOperator: input.conditionOperator,
      conditionValue: input.conditionValue,
      actionType: input.actionType,
      actionValue: input.actionValue,
      enabled: input.enabled ?? true,
      sortOrder: input.sortOrder ?? 0,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateEmailRuleInput): Promise<EmailRule | null> {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.conditionField !== undefined) updates.conditionField = input.conditionField;
    if (input.conditionOperator !== undefined) updates.conditionOperator = input.conditionOperator;
    if (input.conditionValue !== undefined) updates.conditionValue = input.conditionValue;
    if (input.actionType !== undefined) updates.actionType = input.actionType;
    if (input.actionValue !== undefined) updates.actionValue = input.actionValue;
    if (input.enabled !== undefined) updates.enabled = input.enabled;
    if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

    const rows = await this.db.update(emailRules)
      .set(updates)
      .where(eq(emailRules.id, id))
      .returning();
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(emailRules).where(eq(emailRules.id, id)).returning();
    return rows.length > 0;
  }

  private toDomain(row: typeof emailRules.$inferSelect): EmailRule {
    return {
      id: row.id,
      name: row.name,
      conditionField: row.conditionField as EmailRule["conditionField"],
      conditionOperator: row.conditionOperator as EmailRule["conditionOperator"],
      conditionValue: row.conditionValue,
      actionType: row.actionType as EmailRule["actionType"],
      actionValue: row.actionValue,
      enabled: row.enabled,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt!,
      updatedAt: row.updatedAt!,
    };
  }
}
