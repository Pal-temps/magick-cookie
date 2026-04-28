// ClickUp tools — Phase 5.3 of the AI integration plan.
// Wraps ClickUpApiClient via ProviderService. All 4 ClickUp tools default to `auto`
// permission — none are public-visible like a PR review, and ClickUp tasks are
// internal team workflow.

import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { ProviderService } from "../../provider/provider.service";
import { PROVIDER_NOT_CONFIGURED } from "../../provider/provider.service";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD attendu");

function errorPayload(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) };
}

export function createClickUpTools(provider: ProviderService): AgentTool[] {
  return [
    defineTool({
      name: "clickup_create_task",
      description: "Cree une tache ClickUp dans une liste donnee. listId est l'ID de liste ClickUp (visible dans l'URL de la liste).",
      params: z.object({
        listId: z.string().min(1).max(100).describe("ID de la liste ClickUp"),
        name: z.string().min(1).max(500).describe("Nom de la tache"),
        description: z.string().max(65_536).optional().describe("Description (markdown)"),
        assigneeIds: z.array(z.number().int().min(1)).max(20).optional().describe("IDs numeriques ClickUp des assignees"),
        priority: z.number().int().min(1).max(4).optional().describe("Priorite 1=Urgent, 2=High, 3=Normal, 4=Low"),
        dueDate: isoDate.optional().describe("Date d'echeance YYYY-MM-DD"),
      }),
      execute: async ({ listId, name, description, assigneeIds, priority, dueDate }) => {
        const client = await provider.getClickUpClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("clickup");
        try {
          const task = await client.createTask(listId, {
            name,
            description,
            assigneeIds,
            priority,
            dueDate: dueDate ? new Date(dueDate) : undefined,
          });
          return { created: true, id: task.id, url: task.url };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "clickup_assign",
      description: "Modifie les assignees d'une tache ClickUp. Add = a ajouter, remove = a retirer (les deux peuvent etre vides selon l'intention).",
      params: z.object({
        taskId: z.string().min(1).max(100).describe("ID de la tache ClickUp"),
        add: z.array(z.number().int().min(1)).max(20).optional().describe("IDs a ajouter"),
        remove: z.array(z.number().int().min(1)).max(20).optional().describe("IDs a retirer"),
      }),
      execute: async ({ taskId, add, remove }) => {
        const adds = add ?? [];
        const rems = remove ?? [];
        if (adds.length === 0 && rems.length === 0) {
          return { error: "Specifier au moins 'add' ou 'remove'" };
        }
        const client = await provider.getClickUpClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("clickup");
        try {
          await client.assignTask(taskId, adds, rems);
          return { updated: true, taskId, added: adds, removed: rems };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "clickup_change_status",
      description: "Change le statut d'une tache ClickUp (ex: 'in progress', 'done'). Le statut doit exister dans la liste/space.",
      params: z.object({
        taskId: z.string().min(1).max(100).describe("ID de la tache"),
        status: z.string().min(1).max(100).describe("Nouveau statut (correspondance exacte)"),
      }),
      execute: async ({ taskId, status }) => {
        const client = await provider.getClickUpClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("clickup");
        try {
          await client.changeTaskStatus(taskId, status);
          return { updated: true, taskId, status };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "clickup_add_comment",
      description: "Ajoute un commentaire sur une tache ClickUp.",
      params: z.object({
        taskId: z.string().min(1).max(100),
        body: z.string().min(1).max(65_536).describe("Corps du commentaire"),
        notifyAll: z.boolean().optional().describe("Notifier tous les watchers (defaut: false)"),
      }),
      execute: async ({ taskId, body, notifyAll }) => {
        const client = await provider.getClickUpClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("clickup");
        try {
          const comment = await client.addTaskComment(taskId, body, notifyAll ?? false);
          return { added: true, commentId: comment.id };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),
  ];
}
