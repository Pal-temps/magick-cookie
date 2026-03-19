import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { connectorConfigs } from "../database/schema";
import type { ConnectorConfigRepository } from "../../domain/connector-config/connector-config.repository";
import type { ConnectorConfig, ConnectorType } from "../../domain/connector-config/connector-config.entity";

export class DrizzleConnectorConfigRepository implements ConnectorConfigRepository {
  constructor(private db: Database) {}

  async findByType(type: ConnectorType): Promise<ConnectorConfig | null> {
    const rows = await this.db.select().from(connectorConfigs).where(eq(connectorConfigs.type, type)).limit(1);
    if (rows.length === 0) return null;
    return this.toDomain(rows[0]);
  }

  async findAll(): Promise<ConnectorConfig[]> {
    const rows = await this.db.select().from(connectorConfigs);
    return rows.map((r) => this.toDomain(r));
  }

  async upsert(input: { type: ConnectorType; token: string; settings: Record<string, unknown> }): Promise<ConnectorConfig> {
    const existing = await this.db.select().from(connectorConfigs).where(eq(connectorConfigs.type, input.type)).limit(1);

    if (existing.length > 0) {
      const [updated] = await this.db
        .update(connectorConfigs)
        .set({
          token: input.token,
          settings: JSON.stringify(input.settings),
        })
        .where(eq(connectorConfigs.id, existing[0].id))
        .returning();
      return this.toDomain(updated);
    }

    const [created] = await this.db
      .insert(connectorConfigs)
      .values({
        type: input.type,
        token: input.token,
        settings: JSON.stringify(input.settings),
      })
      .returning();
    return this.toDomain(created);
  }

  async delete(type: ConnectorType): Promise<void> {
    await this.db.delete(connectorConfigs).where(eq(connectorConfigs.type, type));
  }

  private toDomain(row: typeof connectorConfigs.$inferSelect): ConnectorConfig {
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(row.settings) as Record<string, unknown>;
    } catch {}
    return {
      id: row.id,
      type: row.type as ConnectorType,
      token: row.token,
      settings,
      enabled: row.enabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
