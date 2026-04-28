// Routine tools — Phase 4.7 of the AI integration plan.
// Wraps RoutineService — full CRUD. Permission tiers:
//   - routine_delete  user-confirm (destructive)
//   - everything else auto

import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { RoutineService } from "../../routine/routine.service";

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format HH:MM (24h) attendu");
const triggerDays = z.array(z.number().int().min(0).max(6)).max(7);

const routineStep = z.discriminatedUnion("action", [
  z.object({ action: z.literal("navigate"), view: z.string().min(1).max(100) }),
  z.object({ action: z.literal("sync"), target: z.enum(["email", "rss", "github"]) }),
  z.object({ action: z.literal("generate"), target: z.enum(["brief", "changelog", "rss-digest"]) }),
  z.object({ action: z.literal("notify"), title: z.string().min(1).max(200), body: z.string().max(2000) }),
]);

function errorPayload(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) };
}

export function createRoutineTools(routines: RoutineService): AgentTool[] {
  return [
    defineTool({
      name: "routine_list",
      description: "Liste toutes les routines (sequences d'actions automatisees).",
      params: z.object({
        enabledOnly: z.boolean().optional().describe("True = uniquement les routines activees"),
      }),
      execute: async ({ enabledOnly }) => {
        const all = enabledOnly ? await routines.getEnabled() : await routines.getAll();
        return { count: all.length, routines: all };
      },
    }),

    defineTool({
      name: "routine_create",
      description: "Cree une nouvelle routine. triggerDays: 0=Dim..6=Sam. Steps possibles: navigate, sync (email/rss/github), generate (brief/changelog/rss-digest), notify.",
      params: z.object({
        name: z.string().min(1).max(255),
        triggerTime: HHMM.describe("Heure de declenchement HH:MM 24h"),
        triggerDays: triggerDays.optional().describe("Jours (0=Dim..6=Sam). Vide = tous les jours."),
        steps: z.array(routineStep).max(20).optional().describe("Sequence d'actions"),
        enabled: z.boolean().optional(),
      }),
      execute: async ({ name, triggerTime, triggerDays, steps, enabled }) => {
        try {
          const created = await routines.create({ name, triggerTime, triggerDays, steps, enabled });
          return { created: true, routine: created };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "routine_update",
      description: "Modifie une routine. Seuls les champs fournis sont mis a jour. steps remplace integralement la sequence.",
      params: z.object({
        id: z.string().min(1).max(100),
        name: z.string().min(1).max(255).optional(),
        triggerTime: HHMM.optional(),
        triggerDays: triggerDays.optional(),
        steps: z.array(routineStep).max(20).optional(),
        enabled: z.boolean().optional(),
      }),
      execute: async ({ id, name, triggerTime, triggerDays, steps, enabled }) => {
        try {
          const updated = await routines.update(id, {
            ...(name !== undefined && { name }),
            ...(triggerTime !== undefined && { triggerTime }),
            ...(triggerDays !== undefined && { triggerDays }),
            ...(steps !== undefined && { steps }),
            ...(enabled !== undefined && { enabled }),
          });
          if (!updated) return { error: `Routine introuvable: ${id}` };
          return { updated: true, routine: updated };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "routine_delete",
      description: "Supprime une routine. Action destructive — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        id: z.string().min(1).max(100),
      }),
      execute: async ({ id }) => {
        try {
          const ok = await routines.delete(id);
          if (!ok) return { error: `Routine introuvable: ${id}` };
          return { deleted: true, id };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),
  ];
}
