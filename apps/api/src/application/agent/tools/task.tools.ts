import type { AgentTool } from "../tool-registry";
import type { TaskService } from "../../task/task.service";
import type { TriageService } from "../../triage/triage.service";
import type { TriageStatus } from "../../../domain/triage/triage.entity";

export function createTaskTools(taskService: TaskService, triageService: TriageService): AgentTool[] {
  return [
    {
      name: "get_all_tasks",
      description: "Liste toutes les taches. Peut filtrer par source (clickup, manual).",
      parameters: {
        source: { type: "string", description: "Filtrer par source : clickup ou manual", required: false },
      },
      execute: async () => {
        const tasks = await taskService.getAll();
        return tasks.slice(0, 30); // Limiter pour ne pas surcharger le LLM
      },
    },
    {
      name: "get_priority_tasks",
      description: "Liste les taches triees comme prioritaires",
      parameters: {},
      execute: async () => {
        const triage = await triageService.getByStatus("priority");
        return triage;
      },
    },
    {
      name: "get_triage_by_status",
      description: "Liste les taches triees par statut",
      parameters: {
        status: { type: "string", description: "Statut : priority, later, archived, dismissed", required: true },
      },
      execute: async (params) => {
        return triageService.getByStatus(params.status as TriageStatus);
      },
    },
    {
      name: "set_triage",
      description: "Trie une tache : la marquer comme priority, later, archived ou dismissed",
      parameters: {
        taskId: { type: "string", description: "ID de la tache", required: true },
        status: { type: "string", description: "Nouveau statut : priority, later, archived, dismissed", required: true },
      },
      execute: async (params) => {
        await triageService.setTriage({ taskId: params.taskId as string, triageStatus: params.status as TriageStatus });
        return { success: true, taskId: params.taskId, status: params.status };
      },
    },
    {
      name: "create_task",
      description: "Cree une nouvelle tache manuelle (note rapide, idee, todo)",
      parameters: {
        title: { type: "string", description: "Titre de la tache", required: true },
      },
      execute: async (params) => {
        return taskService.create({ title: params.title as string, source: "manual" });
      },
    },
  ];
}
