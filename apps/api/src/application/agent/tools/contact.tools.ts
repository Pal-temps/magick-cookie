// Contact tools — Phase 4.6 of the AI integration plan.
// Wraps ContactService — full CRUD + email lookup. Permission tiers:
//   - contact_delete  user-confirm (destructive)
//   - everything else auto

import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { ContactService } from "../../contact/contact.service";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD attendu");

function errorPayload(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) };
}

function toDate(s?: string | null): Date | null | undefined {
  if (s === undefined) return undefined;
  if (s === null || s === "") return null;
  return new Date(s);
}

export function createContactTools(contacts: ContactService): AgentTool[] {
  return [
    defineTool({
      name: "contact_list",
      description: "Liste tous les contacts (nom, telephone, email, anniversaire).",
      params: z.object({}),
      execute: async () => {
        const all = await contacts.getAll();
        return { count: all.length, contacts: all };
      },
    }),

    defineTool({
      name: "contact_create",
      description: "Cree un nouveau contact.",
      params: z.object({
        name: z.string().min(1).max(255).describe("Nom complet"),
        email: z.string().max(320).email("Email invalide").optional().describe("Adresse email"),
        phone: z.string().max(50).optional().describe("Telephone (format libre)"),
        birthDate: isoDate.optional().describe("Anniversaire YYYY-MM-DD"),
        notes: z.string().max(5000).optional().describe("Notes libres"),
      }),
      execute: async ({ name, email, phone, birthDate, notes }) => {
        try {
          const created = await contacts.create({
            name,
            email: email ?? null,
            phone: phone ?? null,
            birthDate: birthDate ? new Date(birthDate) : null,
            notes: notes ?? null,
          });
          return { created: true, contact: created };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "contact_update",
      description: "Modifie un contact. Seuls les champs fournis sont mis a jour. Passer null vide un champ.",
      params: z.object({
        id: z.string().min(1).max(100).describe("ID du contact"),
        name: z.string().min(1).max(255).optional(),
        email: z.string().max(320).email("Email invalide").nullable().optional(),
        phone: z.string().max(50).nullable().optional(),
        birthDate: isoDate.nullable().optional().describe("YYYY-MM-DD ou null pour effacer"),
        notes: z.string().max(5000).nullable().optional(),
      }),
      execute: async ({ id, name, email, phone, birthDate, notes }) => {
        try {
          const updated = await contacts.update(id, {
            ...(name !== undefined && { name }),
            ...(email !== undefined && { email }),
            ...(phone !== undefined && { phone }),
            ...(birthDate !== undefined && { birthDate: toDate(birthDate) }),
            ...(notes !== undefined && { notes }),
          });
          if (!updated) return { error: `Contact introuvable: ${id}` };
          return { updated: true, contact: updated };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "contact_delete",
      description: "Supprime un contact. Action destructive — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        id: z.string().min(1).max(100).describe("ID du contact a supprimer"),
      }),
      execute: async ({ id }) => {
        try {
          const ok = await contacts.delete(id);
          if (!ok) return { error: `Contact introuvable: ${id}` };
          return { deleted: true, id };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "contact_find_by_email",
      description: "Recherche un contact par email (correspondance exacte, insensible a la casse).",
      params: z.object({
        email: z.string().min(3).max(320).describe("Adresse email"),
      }),
      execute: async ({ email }) => {
        const target = email.trim().toLowerCase();
        const all = await contacts.getAll();
        const match = all.find((c) => c.email?.toLowerCase() === target);
        if (!match) return { found: false, email };
        return { found: true, contact: match };
      },
    }),
  ];
}
