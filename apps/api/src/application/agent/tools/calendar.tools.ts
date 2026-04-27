// Calendar tools for the agent — Phase 4.1 of the AI integration plan.
// Wraps EventService / CalendarService / LlmService — no DB / no business logic here.
// Destructive ops (create, delete) carry permissionLevel: "user-confirm" so the
// dispatcher denies them until the permission channel is wired in P6.

import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { EventService } from "../../event/event.service";
import type { CalendarService } from "../../calendar/calendar.service";
import type { LlmService } from "../../llm/llm.service";

// Accepts both YYYY-MM-DD and full ISO 8601 — the LLM tends to mix the two.
// Date-only strings are normalized to start-of-day; full ISO strings are kept as-is.
const isoDate = z
  .string()
  .min(1)
  .max(40)
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/, "Format ISO attendu (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ssZ)");

const dayOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD attendu");

function parseStart(s: string): Date {
  // Date-only → start of day local; ISO with time → as-is.
  return s.length === 10 ? new Date(`${s}T00:00:00`) : new Date(s);
}
function parseEnd(s: string): Date {
  return s.length === 10 ? new Date(`${s}T23:59:59.999`) : new Date(s);
}

function eventsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  // Half-open interval semantics: events touching at the boundary do NOT overlap.
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function createCalendarTools(
  eventService: EventService,
  calendarService: CalendarService,
  llmService?: LlmService,
): AgentTool[] {
  return [
    defineTool({
      name: "calendar_list",
      description: "Liste les evenements sur une periode. Sans 'from'/'to', retourne aujourd'hui. Optionnel: filtrer sur un calendrier par nom.",
      params: z.object({
        from: isoDate.optional().describe("Debut de la periode (defaut: aujourd'hui 00:00)"),
        to: isoDate.optional().describe("Fin de la periode (defaut: aujourd'hui 23:59)"),
        calendarName: z.string().min(1).max(100).optional().describe("Nom exact du calendrier (insensible a la casse)"),
      }),
      execute: async ({ from, to, calendarName }) => {
        const fromD = from ? parseStart(from) : startOfToday();
        const toD = to ? parseEnd(to) : endOfToday();

        let calendarId: string | undefined;
        if (calendarName) {
          const calendars = await calendarService.getAll();
          const target = calendars.find((c) => c.name.toLowerCase() === calendarName.toLowerCase());
          if (!target) {
            return { error: `Calendrier introuvable: ${calendarName}`, available: calendars.map((c) => c.name) };
          }
          calendarId = target.id;
        }

        const events = await eventService.getAll({ from: fromD, to: toD, calendarId });
        return { count: events.length, events };
      },
    }),

    defineTool({
      name: "calendar_create_event",
      description: "Cree un evenement dans un calendrier. Action sensible — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        calendarId: z.string().min(1).max(100).describe("ID du calendrier cible"),
        title: z.string().min(1).max(500).describe("Titre de l'evenement"),
        startAt: isoDate.describe("Debut (ISO ou YYYY-MM-DD)"),
        endAt: isoDate.describe("Fin (ISO ou YYYY-MM-DD)"),
        description: z.string().max(5000).optional().describe("Description optionnelle"),
        location: z.string().max(500).optional().describe("Lieu optionnel"),
        isAllDay: z.boolean().optional().describe("Journee complete (defaut: false)"),
        reminderMinutesBefore: z.array(z.number().int().min(0).max(60 * 24 * 30)).optional().describe("Liste de rappels en minutes avant le debut"),
      }),
      execute: async ({ calendarId, title, startAt, endAt, description, location, isAllDay, reminderMinutesBefore }) => {
        const start = parseStart(startAt);
        const end = parseEnd(endAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return { error: "Date(s) invalide(s)" };
        }
        if (end.getTime() < start.getTime()) {
          return { error: "endAt doit etre >= startAt" };
        }
        const event = await eventService.create(
          {
            calendarId,
            title,
            startAt: start,
            endAt: end,
            description: description ?? null,
            location: location ?? null,
            isAllDay: isAllDay ?? false,
          },
          reminderMinutesBefore?.map((minutesBefore) => ({ minutesBefore })),
        );
        return { created: true, event };
      },
    }),

    defineTool({
      name: "calendar_update_event",
      description: "Modifie un evenement existant. Seuls les champs fournis sont mis a jour.",
      params: z.object({
        id: z.string().min(1).max(100).describe("ID de l'evenement"),
        title: z.string().min(1).max(500).optional(),
        startAt: isoDate.optional(),
        endAt: isoDate.optional(),
        description: z.string().max(5000).nullable().optional(),
        location: z.string().max(500).nullable().optional(),
        isAllDay: z.boolean().optional(),
      }),
      execute: async ({ id, title, startAt, endAt, description, location, isAllDay }) => {
        const startD = startAt ? parseStart(startAt) : undefined;
        const endD = endAt ? parseEnd(endAt) : undefined;
        if (startD && Number.isNaN(startD.getTime())) return { error: "startAt invalide" };
        if (endD && Number.isNaN(endD.getTime())) return { error: "endAt invalide" };
        if (startD && endD && endD.getTime() < startD.getTime()) {
          return { error: "endAt doit etre >= startAt" };
        }
        const event = await eventService.update(id, {
          ...(title !== undefined && { title }),
          ...(startD !== undefined && { startAt: startD }),
          ...(endD !== undefined && { endAt: endD }),
          ...(description !== undefined && { description }),
          ...(location !== undefined && { location }),
          ...(isAllDay !== undefined && { isAllDay }),
        });
        if (!event) return { error: `Evenement introuvable: ${id}` };
        return { updated: true, event };
      },
    }),

    defineTool({
      name: "calendar_delete_event",
      description: "Supprime un evenement. Action destructive — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        id: z.string().min(1).max(100).describe("ID de l'evenement a supprimer"),
      }),
      execute: async ({ id }) => {
        const ok = await eventService.delete(id);
        if (!ok) return { error: `Evenement introuvable: ${id}` };
        return { deleted: true, id };
      },
    }),

    defineTool({
      name: "calendar_find_conflict",
      description: "Detecte les conflits avec un creneau propose. Retourne la liste des evenements qui chevauchent.",
      params: z.object({
        startAt: isoDate.describe("Debut du creneau propose"),
        endAt: isoDate.describe("Fin du creneau propose"),
        calendarId: z.string().min(1).max(100).optional().describe("Limiter au calendrier indique"),
      }),
      execute: async ({ startAt, endAt, calendarId }) => {
        const start = parseStart(startAt);
        const end = parseEnd(endAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return { error: "Date(s) invalide(s)" };
        }
        if (end.getTime() < start.getTime()) {
          return { error: "endAt doit etre >= startAt" };
        }
        const candidates = await eventService.getAll({ from: start, to: end, calendarId });
        const conflicts = candidates.filter((e) => eventsOverlap(start, end, e.startAt, e.endAt));
        return {
          hasConflict: conflicts.length > 0,
          count: conflicts.length,
          conflicts,
        };
      },
    }),

    defineTool({
      name: "calendar_generate_events_from_prompt",
      description: "Genere une liste d'evenements a partir d'une description en langage naturel. Ne cree rien — appelle calendar_create_event ensuite si l'utilisateur confirme.",
      params: z.object({
        prompt: z.string().min(1).max(5000).describe("Description en langage naturel (ex: 'demain matin meeting client puis sport a 18h')"),
        date: dayOnly.optional().describe("Date de reference YYYY-MM-DD (defaut: aujourd'hui)"),
      }),
      execute: async ({ prompt, date }) => {
        if (!llmService) return { error: "LLM non configure" };
        const refDate = date ?? new Date().toISOString().slice(0, 10);
        const events = await llmService.generateEvents(prompt, refDate);
        return { count: events.length, events };
      },
    }),
  ];
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
