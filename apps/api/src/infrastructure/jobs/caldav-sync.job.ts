import type { CalDavService } from "../../application/caldav/caldav.service";

export function startCalDavSyncJob(caldavService: CalDavService, intervalMs = 30 * 60 * 1000) {
  async function run() {
    try {
      const { total, errors } = await caldavService.syncAll();
      if (total > 0) {
        console.log(`[caldav-sync] Imported ${total} new event(s)`);
      }
      if (errors.length > 0) {
        console.warn(`[caldav-sync] ${errors.length} error(s):`, errors);
      }
    } catch (err) {
      console.error("[caldav-sync] Error:", err);
    }
  }

  // Sync on startup (delayed 15s to let app boot)
  setTimeout(run, 15_000);
  const timer = setInterval(run, intervalMs);

  console.log(`[caldav-sync] Started (interval: ${intervalMs / 1000}s)`);
  return timer;
}
