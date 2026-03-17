import { eq, and } from "drizzle-orm";
import { githubConfig, githubPrs } from "../../infrastructure/database/schema";
import type { GitHubConfig, GitHubPR } from "../../domain/github/github.entity";
import type { Database } from "../../infrastructure/database/client";

export class GitHubService {
  constructor(private db: Database) {}

  async getConfig(): Promise<GitHubConfig | null> {
    const rows = await this.db.select().from(githubConfig).limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
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

  async saveConfig(input: { token: string; username: string; repos: string[] }): Promise<GitHubConfig> {
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
      return {
        id: updated.id,
        token: updated.token,
        username: updated.username,
        repos: JSON.parse(updated.repos) as string[],
        pollIntervalSeconds: updated.pollIntervalSeconds,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    }

    const [created] = await this.db
      .insert(githubConfig)
      .values({
        token: input.token,
        username: input.username,
        repos: JSON.stringify(input.repos),
      })
      .returning();
    return {
      id: created.id,
      token: created.token,
      username: created.username,
      repos: JSON.parse(created.repos) as string[],
      pollIntervalSeconds: created.pollIntervalSeconds,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async syncPRs(): Promise<GitHubPR[]> {
    const cfg = await this.getConfig();
    if (!cfg) return [];

    const allPRs: GitHubPR[] = [];

    for (const repo of cfg.repos) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/pulls?state=open&per_page=50`,
          {
            headers: {
              Authorization: `Bearer ${cfg.token}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "magick-cookie",
            },
          },
        );

        if (!res.ok) {
          // Handle rate limiting gracefully
          if (res.status === 403 || res.status === 429) {
            console.warn(`[github-sync] Rate limited for ${repo}, skipping`);
          } else {
            console.warn(`[github-sync] Failed to fetch ${repo}: ${res.status}`);
          }
          continue;
        }

        const prs = (await res.json()) as any[];

        for (const pr of prs) {
          const reviewRequested =
            pr.requested_reviewers?.some(
              (r: any) => r.login.toLowerCase() === cfg.username.toLowerCase(),
            ) || false;

          const values = {
            prNumber: pr.number as number,
            repo,
            title: (pr.title as string).substring(0, 1000),
            state: pr.draft ? "draft" : "open",
            draft: pr.draft as boolean,
            author: pr.user?.login as string,
            url: pr.html_url as string,
            reviewRequested,
          };

          // Upsert
          const [upserted] = await this.db
            .insert(githubPrs)
            .values(values)
            .onConflictDoUpdate({
              target: [githubPrs.repo, githubPrs.prNumber],
              set: {
                title: values.title,
                state: values.state,
                draft: values.draft,
                author: values.author,
                url: values.url,
                reviewRequested: values.reviewRequested,
              },
            })
            .returning();

          allPRs.push({
            id: upserted.id,
            prNumber: upserted.prNumber,
            repo: upserted.repo,
            title: upserted.title,
            state: upserted.state,
            draft: upserted.draft,
            author: upserted.author,
            url: upserted.url,
            reviewRequested: upserted.reviewRequested,
            createdAt: upserted.createdAt,
            updatedAt: upserted.updatedAt,
          });
        }
      } catch (err) {
        console.error(`[github-sync] Error syncing ${repo}:`, err);
      }
    }

    // Remove PRs from DB that are no longer open (not returned by API)
    // Only for repos we successfully synced
    const syncedRepos = new Set(allPRs.map((p) => p.repo));
    for (const repo of syncedRepos) {
      const activePrNumbers = allPRs.filter((p) => p.repo === repo).map((p) => p.prNumber);
      const dbPrs = await this.db
        .select()
        .from(githubPrs)
        .where(eq(githubPrs.repo, repo));

      for (const dbPr of dbPrs) {
        if (!activePrNumbers.includes(dbPr.prNumber)) {
          await this.db.delete(githubPrs).where(eq(githubPrs.id, dbPr.id));
        }
      }
    }

    return allPRs;
  }

  async getPRs(): Promise<GitHubPR[]> {
    const rows = await this.db.select().from(githubPrs);
    return rows.map((row) => ({
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
    }));
  }

  async deleteConfig(): Promise<void> {
    await this.db.delete(githubConfig);
    await this.db.delete(githubPrs);
  }
}
