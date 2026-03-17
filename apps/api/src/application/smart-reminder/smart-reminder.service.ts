import type { TriageRepository } from "../../domain/triage/triage.repository";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { EmailRepository } from "../../domain/email/email.repository";

export interface SmartAlert {
  type: string;
  message: string;
  count: number;
}

export class SmartReminderService {
  constructor(
    private triageRepo: TriageRepository,
    private taskRepo: TaskRepository,
    private emailRepo: EmailRepository,
  ) {}

  async getAlerts(): Promise<SmartAlert[]> {
    const alerts: SmartAlert[] = [];

    const [stalePriority, untriagedCount, unreadEmails] = await Promise.all([
      this.checkStalePriority(),
      this.checkUntriaged(),
      this.checkUnreadEmails(),
    ]);

    if (stalePriority) alerts.push(stalePriority);
    if (untriagedCount) alerts.push(untriagedCount);
    if (unreadEmails) alerts.push(unreadEmails);

    return alerts;
  }

  private async checkStalePriority(): Promise<SmartAlert | null> {
    const priorityItems = await this.triageRepo.findByStatus("priority");
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const stale = priorityItems.filter((t) => t.triagedAt < threeDaysAgo);
    if (stale.length === 0) return null;

    return {
      type: "stale_priority",
      message: `${stale.length} tache${stale.length > 1 ? "s" : ""} prioritaire${stale.length > 1 ? "s" : ""} en attente depuis >3 jours`,
      count: stale.length,
    };
  }

  private async checkUntriaged(): Promise<SmartAlert | null> {
    const allTasks = await this.taskRepo.findAll();
    const allTriage = await this.triageRepo.findAll();
    const triagedTaskIds = new Set(allTriage.map((t) => t.taskId));
    const untriaged = allTasks.filter((t) => !triagedTaskIds.has(t.id));

    if (untriaged.length === 0) return null;

    return {
      type: "untriaged",
      message: `${untriaged.length} tache${untriaged.length > 1 ? "s" : ""} non triee${untriaged.length > 1 ? "s" : ""}`,
      count: untriaged.length,
    };
  }

  private async checkUnreadEmails(): Promise<SmartAlert | null> {
    const unread = await this.emailRepo.countUnread();
    if (unread <= 10) return null;

    return {
      type: "unread_emails",
      message: `${unread} emails non lus`,
      count: unread,
    };
  }
}
