import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../database/client";
import { fluxItems } from "../database/schema";
import type { FluxRepository } from "../../domain/flux/flux.repository";
import type { FluxItem, FluxEntityType, FluxStatus, SetFluxInput } from "../../domain/flux/flux.entity";

export class DrizzleFluxRepository implements FluxRepository {
  constructor(private db: Database) {}

  async findAll(entityType?: FluxEntityType): Promise<FluxItem[]> {
    const query = this.db.select().from(fluxItems);
    if (entityType) {
      return (await query.where(eq(fluxItems.entityType, entityType)).orderBy(fluxItems.decidedAt)).map(this.toDomain);
    }
    return (await query.orderBy(fluxItems.decidedAt)).map(this.toDomain);
  }

  async findByStatus(status: FluxStatus, entityType?: FluxEntityType): Promise<FluxItem[]> {
    const conditions = [eq(fluxItems.fluxStatus, status)];
    if (entityType) conditions.push(eq(fluxItems.entityType, entityType));

    const rows = await this.db.select().from(fluxItems)
      .where(and(...conditions))
      .orderBy(fluxItems.decidedAt);
    return rows.map(this.toDomain);
  }

  async findByEntity(entityType: FluxEntityType, entityId: string): Promise<FluxItem | null> {
    const rows = await this.db.select().from(fluxItems)
      .where(and(eq(fluxItems.entityType, entityType), eq(fluxItems.entityId, entityId)))
      .limit(1);
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async upsert(input: SetFluxInput): Promise<FluxItem> {
    const rows = await this.db
      .insert(fluxItems)
      .values({
        entityType: input.entityType,
        entityId: input.entityId,
        fluxStatus: input.fluxStatus,
        decidedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [fluxItems.entityType, fluxItems.entityId],
        set: {
          fluxStatus: input.fluxStatus,
          decidedAt: new Date(),
        },
      })
      .returning();

    return this.toDomain(rows[0]);
  }

  async bulkUpsert(inputs: SetFluxInput[]): Promise<void> {
    if (inputs.length === 0) return;
    for (const input of inputs) {
      await this.upsert(input);
    }
  }

  async deleteByEntity(entityType: FluxEntityType, entityId: string): Promise<void> {
    await this.db.delete(fluxItems)
      .where(and(eq(fluxItems.entityType, entityType), eq(fluxItems.entityId, entityId)));
  }

  async deleteAll(): Promise<void> {
    await this.db.delete(fluxItems);
  }

  async countByStatus(entityType?: FluxEntityType): Promise<Record<string, number>> {
    const query = entityType
      ? this.db.select({ status: fluxItems.fluxStatus, count: sql<number>`count(*)::int` })
          .from(fluxItems).where(eq(fluxItems.entityType, entityType)).groupBy(fluxItems.fluxStatus)
      : this.db.select({ status: fluxItems.fluxStatus, count: sql<number>`count(*)::int` })
          .from(fluxItems).groupBy(fluxItems.fluxStatus);

    const rows = await query;
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.status] = Number(row.count);
    }
    return result;
  }

  async countByDateRange(from: Date, to: Date): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(fluxItems)
      .where(and(gte(fluxItems.decidedAt, from), lte(fluxItems.decidedAt, to)));
    return Number(rows[0]?.count ?? 0);
  }

  private toDomain(row: typeof fluxItems.$inferSelect): FluxItem {
    return {
      id: row.id,
      entityType: row.entityType as FluxEntityType,
      entityId: row.entityId,
      fluxStatus: row.fluxStatus as FluxStatus,
      decidedAt: row.decidedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
