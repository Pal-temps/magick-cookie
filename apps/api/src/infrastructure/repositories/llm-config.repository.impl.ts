import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { llmConfigs } from "../database/schema";
import type { LlmConfigRepository } from "../../domain/llm/llm-config.repository";
import type { LlmConfig, CreateLlmConfigInput } from "../../domain/llm/llm-config.entity";

export class DrizzleLlmConfigRepository implements LlmConfigRepository {
  constructor(private db: Database) {}

  async getActive(): Promise<LlmConfig | null> {
    const rows = await this.db.select().from(llmConfigs)
      .where(eq(llmConfigs.enabled, true))
      .limit(1);
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async upsert(input: CreateLlmConfigInput): Promise<LlmConfig> {
    // Get existing active config
    const existing = await this.getActive();

    if (existing) {
      const rows = await this.db.update(llmConfigs)
        .set({
          provider: input.provider,
          baseUrl: input.baseUrl,
          model: input.model,
          apiKey: input.apiKey ?? null,
          maxTokens: input.maxTokens ?? 2048,
          temperature: input.temperature?.toString() ?? "0.7",
          enabled: input.enabled ?? true,
        })
        .where(eq(llmConfigs.id, existing.id))
        .returning();
      return this.toDomain(rows[0]);
    }

    const rows = await this.db.insert(llmConfigs)
      .values({
        provider: input.provider,
        baseUrl: input.baseUrl,
        model: input.model,
        apiKey: input.apiKey ?? null,
        maxTokens: input.maxTokens ?? 2048,
        temperature: input.temperature?.toString() ?? "0.7",
        enabled: input.enabled ?? true,
      })
      .returning();
    return this.toDomain(rows[0]);
  }

  private toDomain(row: typeof llmConfigs.$inferSelect): LlmConfig {
    return {
      id: row.id,
      provider: row.provider,
      baseUrl: row.baseUrl,
      model: row.model,
      apiKey: row.apiKey,
      maxTokens: row.maxTokens,
      temperature: parseFloat(row.temperature),
      enabled: row.enabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
