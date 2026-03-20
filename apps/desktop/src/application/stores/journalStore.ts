import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../../infrastructure/api/apiClient";
import type { BriefResponse } from "./analyticsStore";

interface TimerStats {
  totalSeconds: number;
  sessionCount: number;
}

const [generating, setGenerating] = createSignal(false);

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatBrief(brief: BriefResponse): string {
  if (brief.brief) {
    return brief.brief;
  }

  const lines: string[] = [];
  const raw = brief.rawData;
  if (!raw) return "_Pas de donnees disponibles._";

  // Yesterday
  if (raw.yesterday.totalFocusSeconds > 0 || raw.yesterday.timerSessions.length > 0) {
    const h = Math.floor(raw.yesterday.totalFocusSeconds / 3600);
    const m = Math.floor((raw.yesterday.totalFocusSeconds % 3600) / 60);
    lines.push(`- Hier : ${h}h${String(m).padStart(2, "0")} de focus (${raw.yesterday.timerSessions.length} sessions)`);
  }

  if (raw.yesterday.triagedTasks.length > 0) {
    lines.push(`- ${raw.yesterday.triagedTasks.length} taches triees hier`);
  }

  // Today
  if (raw.today.events.length > 0) {
    lines.push(`- ${raw.today.events.length} evenement(s) aujourd'hui`);
  }

  if (raw.today.priorityTasks.length > 0) {
    lines.push(`- ${raw.today.priorityTasks.length} tache(s) prioritaire(s)`);
  }

  if (raw.today.unreadEmails > 0) {
    lines.push(`- ${raw.today.unreadEmails} email(s) non lu(s)`);
  }

  return lines.length > 0 ? lines.join("\n") : "_Pas de donnees disponibles._";
}

export function useJournalStore() {
  async function generateJournal(date?: Date): Promise<string> {
    const d = date || new Date();
    const dateStr = formatDate(d);
    const path = `journal/${dateStr}.md`;

    const { trackAiActivity } = await import("./aiActivityStore");
    setGenerating(true);
    try {
      const [brief, stats] = await Promise.all([
        trackAiActivity("Journal du jour IA", () =>
          api.post<BriefResponse>("/brief/generate", { date: dateStr })
        ).catch(() => null),
        api.get<TimerStats>("/timer-sessions/stats/today").catch(() => null),
      ]);

      const dayLabel = d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const lines = [
        `# Journal — ${dayLabel}`,
        "",
        "## Resume du jour",
        brief?.brief || brief?.rawData ? formatBrief(brief!) : "_Pas de donnees disponibles._",
        "",
        "## Focus",
        stats
          ? `- Temps total: ${Math.floor(stats.totalSeconds / 3600)}h${String(Math.floor((stats.totalSeconds % 3600) / 60)).padStart(2, "0")} (${stats.sessionCount} sessions)`
          : "_Aucune session._",
        "",
        "## Notes",
        "",
        "_Ecrire ici..._",
        "",
      ];

      await invoke("notes_save", { path, content: lines.join("\n") });
      return path;
    } finally {
      setGenerating(false);
    }
  }

  return {
    generating,
    generateJournal,
  };
}
