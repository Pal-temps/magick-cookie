import type { AgentTool } from "../tool-registry";
import type { TaskService } from "../../task/task.service";
import type { FluxService } from "../../flux/flux.service";
import type { FluxStatus, FluxEntityType } from "../../../domain/flux/flux.entity";

export function createTaskTools(taskService: TaskService, fluxService: FluxService): AgentTool[] {
  return [
    {
      name: "get_all_tasks",
      description: "Liste toutes les taches. Peut filtrer par source (clickup, manual).",
      parameters: {
        source: { type: "string", description: "Filtrer par source : clickup ou manual", required: false },
      },
      execute: async () => {
        const tasks = await taskService.getAll();
        return tasks.slice(0, 30);
      },
    },
    {
      name: "get_priority_items",
      description: "Liste les elements marques comme prioritaires dans Flux",
      parameters: {
        entityType: { type: "string", description: "Type : task, email, rss_article (optionnel)", required: false },
      },
      execute: async (params) => {
        return fluxService.getByStatus("priority", params.entityType as FluxEntityType | undefined);
      },
    },
    {
      name: "get_flux_by_status",
      description: "Liste les elements tries par statut dans Flux",
      parameters: {
        status: { type: "string", description: "Statut : priority, later, archived, dismissed", required: true },
        entityType: { type: "string", description: "Type : task, email, rss_article (optionnel)", required: false },
      },
      execute: async (params) => {
        return fluxService.getByStatus(params.status as FluxStatus, params.entityType as FluxEntityType | undefined);
      },
    },
    {
      name: "set_flux",
      description: "Trie un element (tache, email, article) : le marquer comme priority, later, archived ou dismissed",
      parameters: {
        entityType: { type: "string", description: "Type : task, email, rss_article", required: true },
        entityId: { type: "string", description: "ID de l'element", required: true },
        status: { type: "string", description: "Nouveau statut : priority, later, archived, dismissed", required: true },
      },
      execute: async (params) => {
        await fluxService.setFlux({
          entityType: params.entityType as FluxEntityType,
          entityId: params.entityId as string,
          fluxStatus: params.status as FluxStatus,
        });
        return { success: true, entityType: params.entityType, entityId: params.entityId, status: params.status };
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
