import type { AgentTool } from "../tool-registry";
import type { AnalyticsService } from "../../analytics/analytics.service";

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentISOWeek(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dayOfYear = Math.floor((now.getTime() - jan4.getTime()) / 86400000) + jan4.getDay();
  const week = Math.ceil(dayOfYear / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function createAnalyticsTools(analyticsService: AnalyticsService): AgentTool[] {
  return [
    {
      name: "get_productivity_overview",
      description: "Recupere les stats de productivite sur une periode : temps de focus, sessions, triage, wellness, emails, events, balades",
      parameters: {
        from: { type: "string", description: "Date debut YYYY-MM-DD", required: true },
        to: { type: "string", description: "Date fin YYYY-MM-DD", required: true },
      },
      execute: async (params) => {
        const from = new Date(params.from as string);
        const to = new Date((params.to as string) + "T23:59:59");
        return analyticsService.getOverview(from, to);
      },
    },
    {
      name: "get_streak",
      description: "Recupere le streak de focus : jours consecutifs avec du temps de focus, record, et activite des 30 derniers jours",
      parameters: {},
      execute: async () => analyticsService.getStreak(),
    },
    {
      name: "get_weekly_review",
      description: "Recupere le bilan hebdomadaire avec comparaison a la semaine precedente (deltas en %)",
      parameters: {
        week: { type: "string", description: "Semaine ISO YYYY-WNN (ex: 2026-W12). Si non fourni, semaine courante.", required: false },
      },
      execute: async (params) => {
        const week = (params.week as string) || currentISOWeek();
        return analyticsService.getWeeklyReview(week);
      },
    },
    {
      name: "get_productivity_patterns",
      description: "Analyse les patterns de productivite : meilleures heures, meilleurs jours, tendance hebdo",
      parameters: {
        from: { type: "string", description: "Date debut YYYY-MM-DD", required: true },
        to: { type: "string", description: "Date fin YYYY-MM-DD", required: true },
      },
      execute: async (params) => {
        const from = new Date(params.from as string);
        const to = new Date((params.to as string) + "T23:59:59");
        return analyticsService.getProductivityPatterns(from, to);
      },
    },
    {
      name: "get_time_by_project",
      description: "Recupere le temps passe par projet sur une periode",
      parameters: {
        from: { type: "string", description: "Date debut YYYY-MM-DD", required: true },
        to: { type: "string", description: "Date fin YYYY-MM-DD", required: true },
      },
      execute: async (params) => {
        const from = new Date(params.from as string);
        const to = new Date((params.to as string) + "T23:59:59");
        return analyticsService.getTimeByProject(from, to);
      },
    },
    {
      name: "get_today_stats",
      description: "Recupere les stats du jour : focus, sessions, streak. Utilise cette fonction pour repondre aux questions sur 'aujourd'hui'.",
      parameters: {},
      execute: async () => {
        const today = formatDate(new Date());
        return analyticsService.getOverview(new Date(today), new Date(today + "T23:59:59"));
      },
    },
  ];
}
