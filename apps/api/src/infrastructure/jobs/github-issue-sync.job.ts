import type { GitHubSyncService } from "../../application/connector/github-sync.service";

export function startGitHubIssueSyncJob(syncService: GitHubSyncService, intervalMs = 5 * 60 * 1000) {
  async function run() {
    try {
      const result = await syncService.sync();
      if (result.tasksUpserted > 0) {
        console.log(`[github-issue-sync] Synced ${result.tasksUpserted} issue(s)/PR(s)`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("not configured")) {
        console.error("[github-issue-sync] Error:", msg);
      }
    }
  }

  setTimeout(run, 20_000);
  const timer = setInterval(run, intervalMs);
  console.log(`[github-issue-sync] Started (interval: ${intervalMs / 1000}s)`);
  return timer;
}
