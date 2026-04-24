import { and, eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { syncedIssues } from "../database/schema";
import type { GitHubPRRepository } from "../../domain/github/github.repository";
import type { GitHubPR } from "../../domain/github/github.entity";

const SOURCE = "github";

export class DrizzleGitHubPRRepository implements GitHubPRRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<GitHubPR[]> {
    const rows = await this.db.select().from(syncedIssues).where(eq(syncedIssues.source, SOURCE));
    return rows.map(this.toDomain);
  }

  async findByRepo(repo: string): Promise<GitHubPR[]> {
    const rows = await this.db
      .select()
      .from(syncedIssues)
      .where(and(eq(syncedIssues.source, SOURCE), eq(syncedIssues.repo, repo)));
    return rows.map(this.toDomain);
  }

  async upsert(pr: Omit<GitHubPR, "id" | "source" | "createdAt" | "updatedAt">): Promise<GitHubPR> {
    const externalId = `${pr.repo}#${pr.prNumber}`;
    const [upserted] = await this.db
      .insert(syncedIssues)
      .values({
        source: SOURCE,
        externalId,
        prNumber: pr.prNumber,
        repo: pr.repo,
        title: pr.title,
        state: pr.state,
        draft: pr.draft,
        author: pr.author,
        url: pr.url,
        reviewRequested: pr.reviewRequested,
      })
      .onConflictDoUpdate({
        target: [syncedIssues.source, syncedIssues.externalId],
        set: {
          title: pr.title,
          state: pr.state,
          draft: pr.draft,
          author: pr.author,
          url: pr.url,
          reviewRequested: pr.reviewRequested,
        },
      })
      .returning();
    return this.toDomain(upserted);
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(syncedIssues).where(eq(syncedIssues.id, id));
  }

  async deleteAll(): Promise<void> {
    await this.db.delete(syncedIssues).where(eq(syncedIssues.source, SOURCE));
  }

  private toDomain(row: typeof syncedIssues.$inferSelect): GitHubPR {
    return {
      id: row.id,
      source: row.source,
      externalId: row.externalId,
      prNumber: row.prNumber,
      repo: row.repo,
      title: row.title,
      state: row.state,
      draft: row.draft,
      author: row.author,
      url: row.url,
      reviewRequested: row.reviewRequested,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
