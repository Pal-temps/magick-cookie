import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { TimerSessionService } from "../../timer-session/timer-session.service";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu YYYY-MM-DD");

export function createTimerTools(timerService: TimerSessionService): AgentTool[] {
  return [
    defineTool({
      name: "get_today_timer_stats",
      description: "Recupere les stats timer du jour (temps total, nombre de sessions)",
      params: z.object({}),
      execute: async () => timerService.getTodayStats(),
    }),
    defineTool({
      name: "get_timer_sessions",
      description: "Liste les sessions timer sur une periode",
      params: z.object({
        from: isoDate.describe("Date debut YYYY-MM-DD"),
        to: isoDate.describe("Date fin YYYY-MM-DD"),
      }),
      execute: async ({ from, to }) => {
        const sessions = await timerService.getAll(new Date(from), new Date(`${to}T23:59:59`));
        return sessions.slice(0, 20);
      },
    }),
    defineTool({
      name: "save_timer_session",
      description: "Enregistre une session de timer terminee. Utilise pour logger du temps retroactivement.",
      params: z.object({
        mode: z.string().min(1).max(50).describe("Mode : pomodoro ou free"),
        durationMinutes: z.number().int().min(0).describe("Duree prevue en minutes"),
        actualSeconds: z.number().int().min(0).describe("Duree reelle en secondes"),
        completed: z.boolean().optional().describe("Session completee ou non"),
        label: z.string().max(255).optional().describe("Note/label de session"),
        projectId: z.string().optional().describe("ID du projet associe"),
        taskId: z.string().optional().describe("ID de la tache associee"),
      }),
      execute: async ({ mode, durationMinutes, actualSeconds, completed, label, projectId, taskId }) => {
        const now = new Date();
        const startedAt = new Date(now.getTime() - actualSeconds * 1000);
        return timerService.create({
          mode,
          durationMinutes,
          actualSeconds,
          startedAt,
          endedAt: now,
          completed: completed ?? true,
          label: label ?? null,
          projectId: projectId ?? null,
          taskId: taskId ?? null,
        });
      },
    }),
  ];
}
