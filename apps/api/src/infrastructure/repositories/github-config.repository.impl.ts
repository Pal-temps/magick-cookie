import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { githubConfig } from "../database/schema";
import type { GitHubConfigRepository } from "../../domain/github/github.repository";
import type { GitHubConfig } from "../../domain/github/github.entity";

export class DrizzleGitHubConfigRepository implements GitHubConfigRepository {
  constructor(private db: Database) {}

  async get(): Promise<GitHubConfig | null> {
    const rows = await this.db.select().from(githubConfig).limit(1);
    if (rows.length === 0) return null;
    return this.toDomain(rows[0]);
  }

  async save(input: { token: string; username: string; repos: string[] }): Promise<GitHubConfig> {
    const existing = await this.db.select().from(githubConfig).limit(1);

    if (existing.length > 0) {
      const [updated] = await this.db
        .update(githubConfig)
        .set({
          token: input.token,
          username: input.username,
          repos: JSON.stringify(input.repos),
        })
        .where(eq(githubConfig.id, existing[0].id))
        .returning();
      return this.toDomain(updated);
    }

    const [created] = await this.db
      .insert(githubConfig)
      .values({
        token: input.token,
        username: input.username,
        repos: JSON.stringify(input.repos),
      })
      .returning();
    return this.toDomain(created);
  }

  async delete(): Promise<void> {
    await this.db.delete(githubConfig);
  }

  private toDomain(row: typeof githubConfig.$inferSelect): GitHubConfig {
    return {
      id: row.id,
      token: row.token,
      username: row.username,
      repos: JSON.parse(row.repos) as string[],
      pollIntervalSeconds: row.pollIntervalSeconds,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
