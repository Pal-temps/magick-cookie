import type { RssService } from "../../application/rss/rss.service";

const DEFAULT_RETENTION_DAYS = 90;

// Store last digest result in memory so the API can serve it
let lastDigest: { data: Awaited<ReturnType<RssService["generateDigest"]>>; generatedAt: Date } | null = null;

export function getLastRssDigest() {
  return lastDigest;
}

export function setLastRssDigest(data: Awaited<ReturnType<RssService["generateDigest"]>>) {
  lastDigest = { data, generatedAt: new Date() };
}

export function startRssSyncJob(rssService: RssService, intervalMs = 15 * 60 * 1000) {
  async function run() {
    try {
      const { total, errors } = await rssService.syncAll();
      if (total > 0) {
        console.log(`[rss-sync] Synced ${total} new article(s)`);
      }
      if (errors.length > 0) {
        for (const e of errors) {
          console.warn(`[rss-sync] ${e}`);
        }
      }

      // Cleanup old articles after sync
      await rssService.cleanupOldArticles(DEFAULT_RETENTION_DAYS);
    } catch (err) {
      console.error("[rss-sync] Error:", err);
    }
  }

  // --- Daily digest job ---
  let lastDigestDate = "";

  async function checkDailyDigest() {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const hour = now.getHours();

    // Generate digest once per day, at 7am or later
    if (todayStr !== lastDigestDate && hour >= 7) {
      lastDigestDate = todayStr;
      try {
        console.log("[rss-digest] Generating daily AI digest...");
        const digest = await rssService.generateDigest();
        setLastRssDigest(digest);
        console.log(`[rss-digest] Done — ${digest.highlights.length} highlights, ${digest.totalUnread} articles`);
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        if (msg.includes("No LLM configured") || msg.includes("LLM service not configured")) {
          console.log("[rss-digest] Skipped — no LLM configured");
        } else {
          console.error("[rss-digest] Failed to generate digest:", msg);
        }
      }
    }
  }

  // Sync on startup (delayed 15s to let app boot)
  setTimeout(run, 15_000);
  const timer = setInterval(run, intervalMs);

  // Check digest every 5 minutes
  setTimeout(checkDailyDigest, 30_000);
  setInterval(checkDailyDigest, 5 * 60 * 1000);

  console.log(`[rss-sync] Started (interval: ${intervalMs / 1000}s)`);
  return timer;
}
