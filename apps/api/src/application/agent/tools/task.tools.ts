import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { TaskService } from "../../task/task.service";
import type { FluxService } from "../../flux/flux.service";
import type { FluxStatus, FluxEntityType } from "../../../domain/flux/flux.entity";

const ENTITY_TYPES = ["task", "email", "rss_article"] as const;
const FLUX_STATUSES = ["priority", "later", "archived", "dismissed"] as const;

export function createTaskTools(taskService: TaskService, fluxService: FluxService): AgentTool[] {
  return [
    defineTool({
      name: "get_all_tasks",
      description: "Liste toutes les taches. Peut filtrer par source (clickup, manual).",
      params: z.object({
        source: z.string().optional().describe("Filtrer par source : clickup ou manual"),
      }),
      execute: async () => {
        const tasks = await taskService.getAll();
        return tasks.slice(0, 30);
      },
    }),
    defineTool({
      name: "get_priority_items",
      description: "Liste les elements marques comme prioritaires dans Flux",
      params: z.object({
        entityType: z.enum(ENTITY_TYPES).optional().describe("Type : task, email, rss_article (optionnel)"),
      }),
      execute: async ({ entityType }) => {
        return fluxService.getByStatus("priority", entityType as FluxEntityType | undefined);
      },
    }),
    defineTool({
      name: "get_flux_by_status",
      description: "Liste les elements tries par statut dans Flux",
      params: z.object({
        status: z.enum(FLUX_STATUSES).describe("Statut : priority, later, archived, dismissed"),
        entityType: z.enum(ENTITY_TYPES).optional().describe("Type : task, email, rss_article (optionnel)"),
      }),
      execute: async ({ status, entityType }) => {
        return fluxService.getByStatus(status as FluxStatus, entityType as FluxEntityType | undefined);
      },
    }),
    defineTool({
      name: "set_flux",
      description: "Trie un element (tache, email, article) : le marquer comme priority, later, archived ou dismissed",
      params: z.object({
        entityType: z.enum(ENTITY_TYPES).describe("Type : task, email, rss_article"),
        entityId: z.string().min(1).describe("ID de l'element"),
        status: z.enum(FLUX_STATUSES).describe("Nouveau statut : priority, later, archived, dismissed"),
      }),
      execute: async ({ entityType, entityId, status }) => {
        await fluxService.setFlux({
          entityType: entityType as FluxEntityType,
          entityId,
          fluxStatus: status as FluxStatus,
        });
        return { success: true, entityType, entityId, status };
      },
    }),
    defineTool({
      name: "create_task",
      description: "Cree une nouvelle tache manuelle (note rapide, idee, todo)",
      params: z.object({
        title: z.string().min(1).max(500).describe("Titre de la tache"),
      }),
      execute: async ({ title }) => taskService.create({ title, source: "manual" }),
    }),
  ];
}
