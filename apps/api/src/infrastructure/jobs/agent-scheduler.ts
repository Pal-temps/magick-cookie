import type { PushNotificationRepository } from "../../domain/push/push-notification.repository";
import type { AnalyticsService } from "../../application/analytics/analytics.service";
import type { BriefService } from "../../application/brief/brief.service";
import type { EmailService } from "../../application/email/email.service";
import type { TimerSessionService } from "../../application/timer-session/timer-session.service";

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isWeekday(): boolean {
  const day = new Date().getDay();
  return day >= 1 && day <= 5;
}

function currentHour(): number {
  return new Date().getHours();
}

function currentISOWeek(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dayOfYear = Math.floor((now.getTime() - jan4.getTime()) / 86400000) + jan4.getDay();
  const week = Math.ceil(dayOfYear / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

interface SchedulerDeps {
  pushRepo: PushNotificationRepository;
  analyticsService: AnalyticsService;
  briefService: BriefService;
  emailService: EmailService;
  timerService: TimerSessionService;
}

/** Tracks which jobs have run today to avoid duplicates */
const ranToday = new Map<string, string>(); // jobName → date string

function hasRunToday(jobName: string): boolean {
  const today = formatDate(new Date());
  return ranToday.get(jobName) === today;
}

function markRanToday(jobName: string): void {
  ranToday.set(jobName, formatDate(new Date()));
}

export function startAgentScheduler(deps: SchedulerDeps) {
  const { pushRepo, analyticsService, briefService, emailService, timerService } = deps;

  async function morningBrief() {
    if (!isWeekday() || currentHour() !== 8 || hasRunToday("morning-brief")) return;
    markRanToday("morning-brief");

    try {
      const result = await briefService.generate(new Date());
      const body = result.brief || formatRawBrief(result.rawData);
      await pushRepo.create({ type: "brief", title: "Brief du jour", body });
      console.log("[scheduler] Morning brief generated");
    } catch (e) {
      console.error("[scheduler] Morning brief error:", e);
    }
  }

  async function weeklyReview() {
    const day = new Date().getDay();
    if (day !== 0 || currentHour() !== 19 || hasRunToday("weekly-review")) return;
    markRanToday("weekly-review");

    try {
      const review = await analyticsService.getWeeklyReview(currentISOWeek());
      const c = review.current;
      const hours = Math.floor(c.focus.totalSeconds / 3600);
      const mins = Math.floor((c.focus.totalSeconds % 3600) / 60);
      const body = [
        `**Focus :** ${hours}h${mins} (${c.focus.sessionCount} sessions)${review.deltas.focusSeconds !== null ? ` ${review.deltas.focusSeconds > 0 ? "+" : ""}${review.deltas.focusSeconds}%` : ""}`,
        `**Triage :** ${c.triage.totalTriaged} taches triees`,
        `**Emails :** ${c.email.received} recus, ${c.email.unread} non lus`,
        `**Events :** ${c.events.total} evenements`,
        `**Balades :** ${c.dogWalk.totalWalks} (${Math.floor(c.dogWalk.totalSeconds / 60)} min)`,
      ].join("\n");

      await pushRepo.create({ type: "weekly-review", title: "Bilan de la semaine", body });
      console.log("[scheduler] Weekly review generated");
    } catch (e) {
      console.error("[scheduler] Weekly review error:", e);
    }
  }

  async function streakNudge() {
    if (!isWeekday() || currentHour() !== 17 || hasRunToday("streak-nudge")) return;
    markRanToday("streak-nudge");

    try {
      const [streak, todayStats] = await Promise.all([
        analyticsService.getStreak(),
        timerService.getTodayStats(),
      ]);

      if (streak.currentStreak > 0 && todayStats.totalSeconds === 0) {
        await pushRepo.create({
          type: "streak",
          title: "Streak en danger !",
          body: `Ton streak de ${streak.currentStreak} jours va se briser. Lance un pomodoro !`,
        });
        console.log("[scheduler] Streak nudge sent");
      }
    } catch (e) {
      console.error("[scheduler] Streak nudge error:", e);
    }
  }

  async function inboxAlert() {
    if (hasRunToday("inbox-alert")) return;

    try {
      const count = await emailService.getUnreadCount();
      if (count > 20) {
        markRanToday("inbox-alert");
        await pushRepo.create({
          type: "inbox",
          title: "Inbox deborde",
          body: `Tu as ${count} emails non lus. Prends 10 min pour trier ?`,
        });
        console.log("[scheduler] Inbox alert sent");
      }
    } catch (e) {
      console.error("[scheduler] Inbox alert error:", e);
    }
  }

  async function cleanup() {
    try {
      const deleted = await pushRepo.deleteOlderThan(30);
      if (deleted > 0) console.log(`[scheduler] Cleaned up ${deleted} old notifications`);
    } catch (e) {
      console.error("[scheduler] Cleanup error:", e);
    }
  }

  // Run all checks every 15 minutes
  async function runAll() {
    await morningBrief();
    await weeklyReview();
    await streakNudge();
    await inboxAlert();
  }

  // Delayed start (30s after boot)
  setTimeout(runAll, 30_000);

  // Main loop: every 15 minutes
  const mainTimer = setInterval(runAll, 15 * 60 * 1000);

  // Cleanup: once a day at midnight
  const cleanupTimer = setInterval(cleanup, 24 * 60 * 60 * 1000);

  console.log("[scheduler] Agent scheduler started (15 min interval)");

  return { mainTimer, cleanupTimer };
}

function formatRawBrief(rawData: any): string {
  const lines: string[] = [];

  // Yesterday
  const y = rawData.yesterday;
  if (y) {
    lines.push("**Hier**");
    if (y.totalFocusSeconds > 0) {
      const h = Math.floor(y.totalFocusSeconds / 3600);
      const m = Math.floor((y.totalFocusSeconds % 3600) / 60);
      lines.push(`- ${h}h${String(m).padStart(2, "0")} de focus (${y.timerSessions?.length ?? 0} sessions)`);
    }
    if (y.events?.length > 0) lines.push(`- ${y.events.length} evenement(s)`);
    if (y.triagedTasks?.length > 0) lines.push(`- ${y.triagedTasks.length} tache(s) triee(s)`);
    if (lines.length === 1) lines.push("- RAS");
  }

  // Today
  const t = rawData.today;
  if (t) {
    lines.push("\n**Aujourd'hui**");
    if (t.events?.length > 0) lines.push(`- ${t.events.length} evenement(s)`);
    if (t.priorityTasks?.length > 0) lines.push(`- ${t.priorityTasks.length} tache(s) prioritaire(s)`);
    if (t.unreadEmails > 0) lines.push(`- ${t.unreadEmails} email(s) non lu(s)`);
    if (lines[lines.length - 1] === "\n**Aujourd'hui**") lines.push("- RAS");
  }

  // Blockers
  const b = rawData.blockers;
  if (b && (b.staleTasks?.length > 0 || b.overdueEvents?.length > 0)) {
    lines.push("\n**Blocages**");
    for (const task of b.staleTasks ?? []) {
      lines.push(`- "${task.title}" en priority depuis longtemps`);
    }
    for (const event of b.overdueEvents ?? []) {
      lines.push(`- Event depasse: "${event.title}"`);
    }
  }

  return lines.join("\n") || "Rien a signaler aujourd'hui.";
}
