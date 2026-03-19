import type { RssService } from "../../application/rss/rss.service";

const DEFAULT_RETENTION_DAYS = 90;

export function startRssSyncJob(rssService: RssService, intervalMs = 15 * 60 * 1000) {
  async function run() {
    try {
      const { total, errors } = await rssService.syncAll();
      if (total > 0) {
        console.log(`[rss-sync] Synced ${total} new article(s)`);
      }
      if (errors.length > 0) {
        console.warn(`[rss-sync] ${errors.length} error(s):`, errors);
      }

      // Cleanup old articles after sync
      await rssService.cleanupOldArticles(DEFAULT_RETENTION_DAYS);
    } catch (err) {
      console.error("[rss-sync] Error:", err);
    }
  }

  // Sync on startup (delayed 15s to let app boot)
  setTimeout(run, 15_000);
  const timer = setInterval(run, intervalMs);

  console.log(`[rss-sync] Started (interval: ${intervalMs / 1000}s)`);
  return timer;
}
