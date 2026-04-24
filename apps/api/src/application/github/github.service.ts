import type { ConnectorConfigRepository } from "../../domain/connector-config/connector-config.repository";
import type { ConnectorConfig } from "../../domain/connector-config/connector-config.entity";
import type { GitHubPRRepository } from "../../domain/github/github.repository";
import type { GitHubConfig, GitHubPR, WorkflowRun } from "../../domain/github/github.entity";

const DEFAULT_POLL_INTERVAL_SECONDS = 300;

interface GitHubSettings {
  username?: string;
  repos?: string[];
  pollIntervalSeconds?: number;
  syncIssues?: boolean;
  syncPRs?: boolean;
}

function projectConfig(cfg: ConnectorConfig): GitHubConfig {
  const settings = cfg.settings as GitHubSettings;
  return {
    id: cfg.id,
    token: cfg.token,
    username: settings.username ?? "",
    repos: Array.isArray(settings.repos) ? settings.repos : [],
    pollIntervalSeconds: settings.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS,
    createdAt: cfg.createdAt,
    updatedAt: cfg.updatedAt,
  };
}

export class GitHubService {
  constructor(
    private connectorConfigRepo: ConnectorConfigRepository,
    private prRepo: GitHubPRRepository,
  ) {}

  async getConfig(): Promise<GitHubConfig | null> {
    const cfg = await this.connectorConfigRepo.findByType("github");
    return cfg ? projectConfig(cfg) : null;
  }

  async saveConfig(input: { token: string; username: string; repos: string[] }): Promise<GitHubConfig> {
    // Merge with existing settings so we don't clobber syncIssues/syncPRs/pollInterval.
    const existing = await this.connectorConfigRepo.findByType("github");
    const existingSettings = (existing?.settings as GitHubSettings | undefined) ?? {};
    const merged = await this.connectorConfigRepo.upsert({
      type: "github",
      token: input.token,
      settings: {
        ...existingSettings,
        username: input.username,
        repos: input.repos,
        pollIntervalSeconds: existingSettings.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS,
      },
    });
    return projectConfig(merged);
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

  async getWorkflowRuns(): Promise<WorkflowRun[]> {
    const cfg = await this.getConfig();
    if (!cfg) return [];
    const allRuns: WorkflowRun[] = [];
    for (const repo of cfg.repos) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/actions/runs?per_page=10`,
          {
            headers: {
              Authorization: `Bearer ${cfg.token}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "magick-cookie",
            },
          },
        );
        if (!res.ok) continue;
        const json = (await res.json()) as any;
        for (const run of json.workflow_runs || []) {
          allRuns.push({
            id: run.id,
            repo,
            name: run.name,
            branch: run.head_branch,
            status: run.status,
            conclusion: run.conclusion,
            url: run.html_url,
            createdAt: run.created_at,
            updatedAt: run.updated_at,
          });
        }
      } catch {
        continue;
      }
    }
    return allRuns;
  }

  async deleteConfig(): Promise<void> {
    await this.connectorConfigRepo.delete("github");
    await this.prRepo.deleteAll();
  }
}
