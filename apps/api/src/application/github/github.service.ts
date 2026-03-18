import type { GitHubConfigRepository, GitHubPRRepository } from "../../domain/github/github.repository";
import type { GitHubConfig, GitHubPR } from "../../domain/github/github.entity";

export class GitHubService {
  constructor(
    private configRepo: GitHubConfigRepository,
    private prRepo: GitHubPRRepository,
  ) {}

  async getConfig(): Promise<GitHubConfig | null> {
    return this.configRepo.get();
  }

  async saveConfig(input: { token: string; username: string; repos: string[] }): Promise<GitHubConfig> {
    return this.configRepo.save(input);
  }

  async syncPRs(): Promise<GitHubPR[]> {
    const cfg = await this.configRepo.get();
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

          const upserted = await this.prRepo.upsert({
            prNumber: pr.number as number,
            repo,
            title: (pr.title as string).substring(0, 1000),
            state: pr.draft ? "draft" : "open",
            draft: pr.draft as boolean,
            author: pr.user?.login as string,
            url: pr.html_url as string,
            reviewRequested,
          });

          allPRs.push(upserted);
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
      const dbPrs = await this.prRepo.findByRepo(repo);

      for (const dbPr of dbPrs) {
        if (!activePrNumbers.includes(dbPr.prNumber)) {
          await this.prRepo.deleteById(dbPr.id);
        }
      }
    }

    return allPRs;
  }

  async getPRs(): Promise<GitHubPR[]> {
    return this.prRepo.findAll();
  }

  async deleteConfig(): Promise<void> {
    await this.configRepo.delete();
    await this.prRepo.deleteAll();
  }
}
