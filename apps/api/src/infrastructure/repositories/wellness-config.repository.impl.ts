import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { wellnessConfigs } from "../database/schema";
import type { WellnessConfigRepository } from "../../domain/wellness-config/wellness-config.repository";
import type { WellnessConfig, CreateWellnessConfigInput, UpdateWellnessConfigInput } from "../../domain/wellness-config/wellness-config.entity";

export class DrizzleWellnessConfigRepository implements WellnessConfigRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<WellnessConfig[]> {
    const rows = await this.db.select().from(wellnessConfigs).orderBy(wellnessConfigs.createdAt);
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<WellnessConfig | null> {
    const rows = await this.db.select().from(wellnessConfigs).where(eq(wellnessConfigs.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByType(type: string): Promise<WellnessConfig | null> {
    const rows = await this.db.select().from(wellnessConfigs).where(eq(wellnessConfigs.type, type));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateWellnessConfigInput): Promise<WellnessConfig> {
    const rows = await this.db.insert(wellnessConfigs).values({
      type: input.type,
      label: input.label,
      intervalMinutes: input.intervalMinutes,
      enabled: input.enabled ?? true,
      alertSound: input.alertSound ?? null,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateWellnessConfigInput): Promise<WellnessConfig | null> {
    const values: Record<string, unknown> = {};
    if (input.label !== undefined) values.label = input.label;
    if (input.intervalMinutes !== undefined) values.intervalMinutes = input.intervalMinutes;
    if (input.enabled !== undefined) values.enabled = input.enabled;
    if (input.alertSound !== undefined) values.alertSound = input.alertSound;

    const rows = await this.db.update(wellnessConfigs).set(values).where(eq(wellnessConfigs.id, id)).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(wellnessConfigs).where(eq(wellnessConfigs.id, id)).returning({ id: wellnessConfigs.id });
    return rows.length > 0;
  }

  private toDomain(row: typeof wellnessConfigs.$inferSelect): WellnessConfig {
    return {
      id: row.id,
      type: row.type,
      label: row.label,
      intervalMinutes: row.intervalMinutes,
      enabled: row.enabled,
      alertSound: row.alertSound,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
