import type { AgentTool } from "../tool-registry";
import type { TimerSessionService } from "../../timer-session/timer-session.service";

export function createTimerTools(timerService: TimerSessionService): AgentTool[] {
  return [
    {
      name: "get_today_timer_stats",
      description: "Recupere les stats timer du jour (temps total, nombre de sessions)",
      parameters: {},
      execute: async () => timerService.getTodayStats(),
    },
    {
      name: "get_timer_sessions",
      description: "Liste les sessions timer sur une periode",
      parameters: {
        from: { type: "string", description: "Date debut YYYY-MM-DD", required: true },
        to: { type: "string", description: "Date fin YYYY-MM-DD", required: true },
      },
      execute: async (params) => {
        const sessions = await timerService.getAll(new Date(params.from as string), new Date((params.to as string) + "T23:59:59"));
        return sessions.slice(0, 20);
      },
    },
    {
      name: "save_timer_session",
      description: "Enregistre une session de timer terminee. Utilise pour logger du temps retroactivement.",
      parameters: {
        mode: { type: "string", description: "Mode : pomodoro ou free", required: true },
        durationMinutes: { type: "number", description: "Duree prevue en minutes", required: true },
        actualSeconds: { type: "number", description: "Duree reelle en secondes", required: true },
        completed: { type: "boolean", description: "Session completee ou non", required: false },
        label: { type: "string", description: "Note/label de session", required: false },
        projectId: { type: "string", description: "ID du projet associe", required: false },
        taskId: { type: "string", description: "ID de la tache associee", required: false },
      },
      execute: async (params) => {
        const now = new Date();
        const startedAt = new Date(now.getTime() - (params.actualSeconds as number) * 1000);
        return timerService.create({
          mode: params.mode as string,
          durationMinutes: params.durationMinutes as number,
          actualSeconds: params.actualSeconds as number,
          startedAt: startedAt,
          endedAt: now,
          completed: (params.completed as boolean) ?? true,
          label: (params.label as string) ?? null,
          projectId: (params.projectId as string) ?? null,
          taskId: (params.taskId as string) ?? null,
        });
      },
    },
  ];
}
