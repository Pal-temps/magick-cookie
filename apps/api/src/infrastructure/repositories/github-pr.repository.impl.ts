import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { githubPrs } from "../database/schema";
import type { GitHubPRRepository } from "../../domain/github/github.repository";
import type { GitHubPR } from "../../domain/github/github.entity";

export class DrizzleGitHubPRRepository implements GitHubPRRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<GitHubPR[]> {
    const rows = await this.db.select().from(githubPrs);
    return rows.map(this.toDomain);
  }

  async findByRepo(repo: string): Promise<GitHubPR[]> {
    const rows = await this.db.select().from(githubPrs).where(eq(githubPrs.repo, repo));
    return rows.map(this.toDomain);
  }

  async upsert(pr: Omit<GitHubPR, "id" | "createdAt" | "updatedAt">): Promise<GitHubPR> {
    const [upserted] = await this.db
      .insert(githubPrs)
      .values({
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
        target: [githubPrs.repo, githubPrs.prNumber],
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
    await this.db.delete(githubPrs).where(eq(githubPrs.id, id));
  }

  async deleteAll(): Promise<void> {
    await this.db.delete(githubPrs);
  }

  private toDomain(row: typeof githubPrs.$inferSelect): GitHubPR {
    return {
      id: row.id,
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
