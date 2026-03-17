import type { GitHubService } from "../../application/github/github.service";

export function startGitHubSyncJob(githubService: GitHubService, intervalMs = 5 * 60 * 1000) {
  async function run() {
    try {
      const prs = await githubService.syncPRs();
      if (prs.length > 0) {
        console.log(`[github-sync] Synced ${prs.length} open PR(s)`);
      }
    } catch (err) {
      console.error("[github-sync] Error:", err);
    }
  }

  // Sync on startup (delayed 15s to let app boot)
  setTimeout(run, 15_000);
  const timer = setInterval(run, intervalMs);

  console.log(`[github-sync] Started (interval: ${intervalMs / 1000}s)`);
  return timer;
}
