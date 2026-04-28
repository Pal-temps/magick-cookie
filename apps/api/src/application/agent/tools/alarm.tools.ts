// Alarm tools — Phase 4.7 of the AI integration plan.
// Wraps AlarmService — full CRUD. Permission tiers:
//   - alarm_delete  user-confirm (destructive)
//   - everything else auto

import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { AlarmService } from "../../alarm/alarm.service";

const REPEAT_PATTERNS = ["once", "daily", "weekdays", "weekends", "custom"] as const;
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format HH:MM (24h) attendu");
const repeatDays = z.array(z.number().int().min(0).max(6)).max(7);

function errorPayload(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) };
}

export function createAlarmTools(alarms: AlarmService): AgentTool[] {
  return [
    defineTool({
      name: "alarm_list",
      description: "Liste toutes les alarmes (avec heure, label, repetition, etat enable/disable).",
      params: z.object({
        enabledOnly: z.boolean().optional().describe("True = uniquement les alarmes activees"),
      }),
      execute: async ({ enabledOnly }) => {
        const all = enabledOnly ? await alarms.getEnabled() : await alarms.getAll();
        return { count: all.length, alarms: all };
      },
    }),

    defineTool({
      name: "alarm_create",
      description: "Cree une nouvelle alarme. repeatPattern controle le rappel: 'once' (une fois), 'daily', 'weekdays' (Lun-Ven), 'weekends', 'custom' (specifier repeatDays: 0=Dim..6=Sam).",
      params: z.object({
        time: HHMM.describe("Heure HH:MM 24h"),
        label: z.string().min(1).max(255).describe("Libelle de l'alarme"),
        repeatPattern: z.enum(REPEAT_PATTERNS).optional().describe("Pattern de repetition (defaut: 'once')"),
        repeatDays: repeatDays.optional().describe("Jours pour 'custom' (0=Dim..6=Sam)"),
        enabled: z.boolean().optional().describe("Activee a la creation (defaut: true)"),
        alertSound: z.string().max(255).optional().describe("Son d'alerte"),
      }),
      execute: async ({ time, label, repeatPattern, repeatDays, enabled, alertSound }) => {
        try {
          const created = await alarms.create({
            time,
            label,
            repeatPattern,
            repeatDays,
            enabled,
            alertSound: alertSound ?? null,
          });
          return { created: true, alarm: created };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "alarm_update",
      description: "Modifie une alarme. Seuls les champs fournis sont mis a jour.",
      params: z.object({
        id: z.string().min(1).max(100),
        time: HHMM.optional(),
        label: z.string().min(1).max(255).optional(),
        repeatPattern: z.enum(REPEAT_PATTERNS).optional(),
        repeatDays: repeatDays.nullable().optional(),
        enabled: z.boolean().optional(),
        alertSound: z.string().max(255).nullable().optional(),
      }),
      execute: async ({ id, time, label, repeatPattern, repeatDays, enabled, alertSound }) => {
        try {
          const updated = await alarms.update(id, {
            ...(time !== undefined && { time }),
            ...(label !== undefined && { label }),
            ...(repeatPattern !== undefined && { repeatPattern }),
            ...(repeatDays !== undefined && { repeatDays }),
            ...(enabled !== undefined && { enabled }),
            ...(alertSound !== undefined && { alertSound }),
          });
          if (!updated) return { error: `Alarme introuvable: ${id}` };
          return { updated: true, alarm: updated };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "alarm_delete",
      description: "Supprime une alarme. Action destructive — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        id: z.string().min(1).max(100),
      }),
      execute: async ({ id }) => {
        try {
          const ok = await alarms.delete(id);
          if (!ok) return { error: `Alarme introuvable: ${id}` };
          return { deleted: true, id };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),
  ];
}
