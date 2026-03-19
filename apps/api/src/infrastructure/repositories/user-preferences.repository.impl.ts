import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { userPreferences } from "../database/schema";
import type { UserPreferencesRepository } from "../../domain/user-preferences/user-preferences.repository";
import type { UserPreferencesEntity, UpsertUserPreferencesInput } from "../../domain/user-preferences/user-preferences.entity";

export class DrizzleUserPreferencesRepository implements UserPreferencesRepository {
  constructor(private db: Database) {}

  async find(): Promise<UserPreferencesEntity | null> {
    const rows = await this.db.select().from(userPreferences).limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async upsert(input: UpsertUserPreferencesInput): Promise<UserPreferencesEntity> {
    const existing = await this.find();
    if (existing) {
      const rows = await this.db
        .update(userPreferences)
        .set({ data: input.data, updatedAt: new Date() })
        .where(eq(userPreferences.id, existing.id))
        .returning();
      return this.toDomain(rows[0]);
    }
    const rows = await this.db
      .insert(userPreferences)
      .values({ data: input.data })
      .returning();
    return this.toDomain(rows[0]);
  }

  private toDomain(row: typeof userPreferences.$inferSelect): UserPreferencesEntity {
    return {
      id: row.id,
      data: row.data,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
