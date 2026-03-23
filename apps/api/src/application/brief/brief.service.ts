import type { TimerSessionRepository } from "../../domain/timer-session/timer-session.repository";
import type { EventRepository } from "../../domain/event/event.repository";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { FluxRepository } from "../../domain/flux/flux.repository";
import type { EmailRepository } from "../../domain/email/email.repository";
import type { LlmService } from "../llm/llm.service";
import type { GitScanService } from "../git/git-scan.service";

// --- Interfaces ---

export interface BriefTimerSession {
  label: string | null;
  actualSeconds: number;
  completed: boolean;
}

export interface BriefEvent {
  title: string;
  startAt: string;
}

export interface BriefTask {
  id: string;
  title: string;
  source: string;
}

export interface BriefStaleTask {
  id: string;
  title: string;
  source: string;
  decidedAt: string;
}

export interface BriefGitData {
  commits: { hash: string; message: string; repo: string }[];
  repoCount: number;
  totalCommits: number;
}

export interface BriefRawData {
  yesterday: {
    timerSessions: BriefTimerSession[];
    totalFocusSeconds: number;
    events: BriefEvent[];
    fluxedItems: BriefTask[];
  };
  today: {
    events: BriefEvent[];
    priorityTasks: BriefTask[];
    unreadEmails: number;
  };
  blockers: {
    staleTasks: BriefStaleTask[];
    overdueEvents: BriefEvent[];
  };
  git?: BriefGitData;
}

export interface BriefResponse {
  date: string;
  rawData: BriefRawData;
  brief: string;
}

// --- Service ---

export class BriefService {
  constructor(
    private timerRepo: TimerSessionRepository,
    private eventRepo: EventRepository,
    private taskRepo: TaskRepository,
    private fluxRepo: FluxRepository,
    private emailRepo: EmailRepository,
    private llmService: LlmService | null,
    private gitScanService?: GitScanService,
  ) {}

  async generate(date: Date, customPrompt?: string): Promise<BriefResponse> {
    const rawData = await this.collectData(date);
    const brief = await this.generateBrief(rawData, customPrompt);
    return { date: this.formatDate(date), rawData, brief };
  }

  private async collectData(date: Date): Promise<BriefRawData> {
    const now = new Date();

    // Yesterday
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = this.startOfDay(yesterday);
    const yesterdayEnd = this.endOfDay(yesterday);

    // Today
    const todayStart = this.startOfDay(date);
    const todayEnd = this.endOfDay(date);

    // Parallel fetches
    const [
      yesterdayTimerSessions,
      yesterdayEvents,
      todayEvents,
      allFlux,
      priorityFlux,
      unreadEmails,
    ] = await Promise.all([
      this.timerRepo.findAll(yesterdayStart, yesterdayEnd),
      this.eventRepo.findAll({ from: yesterdayStart, to: yesterdayEnd }),
      this.eventRepo.findAll({ from: todayStart, to: todayEnd }),
      this.fluxRepo.findAll(),
      this.fluxRepo.findByStatus("priority"),
      this.emailRepo.countUnread(),
    ]);

    // Yesterday timer sessions
    const timerSessions: BriefTimerSession[] = yesterdayTimerSessions.map((s) => ({
      label: s.label,
      actualSeconds: s.actualSeconds,
      completed: s.completed,
    }));
    const totalFocusSeconds = yesterdayTimerSessions.reduce((sum, s) => sum + s.actualSeconds, 0);

    // Yesterday events
    const yesterdayBriefEvents: BriefEvent[] = yesterdayEvents.map((e) => ({
      title: e.title,
      startAt: e.startAt.toISOString(),
    }));

    // Yesterday triaged tasks — filter triage items where decidedAt is in yesterday range
    const yesterdayFluxItems = allFlux.filter(
      (t) => t.decidedAt >= yesterdayStart && t.decidedAt <= yesterdayEnd,
    );
    const fluxedItems: BriefTask[] = [];
    for (const item of yesterdayFluxItems) {
      const task = await this.taskRepo.findById(item.entityId);
      if (task) {
        fluxedItems.push({ id: task.id, title: task.title, source: task.source });
      }
    }

    // Today events
    const todayBriefEvents: BriefEvent[] = todayEvents.map((e) => ({
      title: e.title,
      startAt: e.startAt.toISOString(),
    }));

    // Priority tasks
    const priorityTasks: BriefTask[] = [];
    for (const item of priorityFlux) {
      const task = await this.taskRepo.findById(item.entityId);
      if (task) {
        priorityTasks.push({ id: task.id, title: task.title, source: task.source });
      }
    }

    // Blockers — stale priority tasks (decidedAt > 3 days ago)
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const stalePriorityItems = priorityFlux.filter((t) => t.decidedAt < threeDaysAgo);
    const staleTasks: BriefStaleTask[] = [];
    for (const item of stalePriorityItems) {
      const task = await this.taskRepo.findById(item.entityId);
      if (task) {
        staleTasks.push({
          id: task.id,
          title: task.title,
          source: task.source,
          decidedAt: item.decidedAt.toISOString(),
        });
      }
    }

    // Blockers — overdue events (endAt < now and endAt is today)
    const overdueEvents: BriefEvent[] = todayEvents
      .filter((e) => e.endAt < now && e.endAt >= todayStart)
      .map((e) => ({
        title: e.title,
        startAt: e.startAt.toISOString(),
      }));

    // Git activity
    let git: BriefGitData | undefined;
    if (this.gitScanService) {
      try {
        const gitActivity = await this.gitScanService.scanSince(yesterdayStart);
        if (gitActivity.totalCommits > 0) {
          git = gitActivity;
        }
      } catch {
        // Skip git data if scan fails
      }
    }

    return {
      yesterday: {
        timerSessions,
        totalFocusSeconds,
        events: yesterdayBriefEvents,
        fluxedItems,
      },
      today: {
        events: todayBriefEvents,
        priorityTasks,
        unreadEmails,
      },
      blockers: {
        staleTasks,
        overdueEvents,
      },
      ...(git ? { git } : {}),
    };
  }

  private static readonly DEFAULT_PROMPT = `Tu es un assistant qui genere des briefs quotidiens pour un developpeur.

Regles :
- Ecris en francais
- 3-4 sections : "Hier", "Aujourd'hui", "Blocages", et optionnellement "Activite Git" si des commits sont presents
- 2-4 bullet points par section, pas plus
- Utilise des verbes d'action au passe compose (hier) et futur/infinitif (aujourd'hui)
- Si une section est vide, ecris "RAS"
- Mentionne les durees de focus si significatives (> 30min)
- Si des notes de session sont presentes (champ "label"), mentionne-les — elles decrivent ce qui a ete fait ou les blocages
- Pour la section Git, resume les commits par repo (ex: "magick-cookie: 3 commits - refactoring timer, fix bug X")
- Sois concis et actionnable, pas de blabla

Format markdown avec ## pour les titres de section.`;

  private async generateBrief(data: BriefRawData, customPrompt?: string): Promise<string> {
    if (!this.llmService) return "";

    const systemPrompt = customPrompt || BriefService.DEFAULT_PROMPT;

    try {
      return await this.llmService.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(data) },
      ]);
    } catch {
      return "";
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }
}
