import type { GitLabSyncService } from "../../application/connector/gitlab-sync.service";

export function startGitLabSyncJob(syncService: GitLabSyncService, intervalMs = 5 * 60 * 1000) {
  async function run() {
    try {
      const result = await syncService.sync();
      if (result.tasksUpserted > 0) {
        console.log(`[gitlab-sync] Synced ${result.tasksUpserted} issue(s)`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("not configured")) {
        console.error("[gitlab-sync] Error:", msg);
      }
    }
  }

  setTimeout(run, 25_000);
  const timer = setInterval(run, intervalMs);
  console.log(`[gitlab-sync] Started (interval: ${intervalMs / 1000}s)`);
  return timer;
}
