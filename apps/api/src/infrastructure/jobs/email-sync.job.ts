import type { EmailService } from "../../application/email/email.service";

export function startEmailSyncJob(emailService: EmailService, intervalMs = 5 * 60 * 1000) {
  async function run() {
    try {
      const { total, errors } = await emailService.syncAll();
      if (total > 0) {
        console.log(`[email-sync] Synced ${total} new email(s)`);
      }
      if (errors.length > 0) {
        console.warn(`[email-sync] ${errors.length} error(s):`, errors);
      }
    } catch (err) {
      console.error("[email-sync] Error:", err);
    }
  }

  // Sync on startup (delayed 10s to let app boot)
  setTimeout(run, 10_000);
  const timer = setInterval(run, intervalMs);

  console.log(`[email-sync] Started (interval: ${intervalMs / 1000}s)`);
  return timer;
}
