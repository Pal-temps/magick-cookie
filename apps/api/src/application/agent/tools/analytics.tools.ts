import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { AnalyticsService } from "../../analytics/analytics.service";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu YYYY-MM-DD");
const isoWeek = z.string().regex(/^\d{4}-W\d{2}$/, "Format attendu YYYY-WNN").optional();

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
    defineTool({
      name: "get_productivity_overview",
      description: "Recupere les stats de productivite sur une periode : temps de focus, sessions, triage, wellness, emails, events, balades",
      params: z.object({
        from: isoDate.describe("Date debut YYYY-MM-DD"),
        to: isoDate.describe("Date fin YYYY-MM-DD"),
      }),
      execute: async ({ from, to }) => analyticsService.getOverview(new Date(from), new Date(`${to}T23:59:59`)),
    }),
    defineTool({
      name: "get_streak",
      description: "Recupere le streak de focus : jours consecutifs avec du temps de focus, record, et activite des 30 derniers jours",
      params: z.object({}),
      execute: async () => analyticsService.getStreak(),
    }),
    defineTool({
      name: "get_weekly_review",
      description: "Recupere le bilan hebdomadaire avec comparaison a la semaine precedente (deltas en %)",
      params: z.object({
        week: isoWeek.describe("Semaine ISO YYYY-WNN (ex: 2026-W12). Si non fourni, semaine courante."),
      }),
      execute: async ({ week }) => analyticsService.getWeeklyReview(week ?? currentISOWeek()),
    }),
    defineTool({
      name: "get_productivity_patterns",
      description: "Analyse les patterns de productivite : meilleures heures, meilleurs jours, tendance hebdo",
      params: z.object({
        from: isoDate.describe("Date debut YYYY-MM-DD"),
        to: isoDate.describe("Date fin YYYY-MM-DD"),
      }),
      execute: async ({ from, to }) => analyticsService.getProductivityPatterns(new Date(from), new Date(`${to}T23:59:59`)),
    }),
    defineTool({
      name: "get_time_by_project",
      description: "Recupere le temps passe par projet sur une periode",
      params: z.object({
        from: isoDate.describe("Date debut YYYY-MM-DD"),
        to: isoDate.describe("Date fin YYYY-MM-DD"),
      }),
      execute: async ({ from, to }) => analyticsService.getTimeByProject(new Date(from), new Date(`${to}T23:59:59`)),
    }),
    defineTool({
      name: "get_today_stats",
      description: "Recupere les stats du jour : focus, sessions, streak. Utilise cette fonction pour repondre aux questions sur 'aujourd'hui'.",
      params: z.object({}),
      execute: async () => {
        const today = formatDate(new Date());
        return analyticsService.getOverview(new Date(today), new Date(`${today}T23:59:59`));
      },
    }),
  ];
}
