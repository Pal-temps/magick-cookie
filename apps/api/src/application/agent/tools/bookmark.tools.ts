// Bookmark tools — Phase 4.4 of the AI integration plan.
// Replaces the 2-tool createBookmarkTools that lived in brief.tools.ts (one file
// per domain per the plan DDD). Permission tiers:
//   - bookmark_delete  user-confirm (destructive)
//   - everything else  auto

import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { BookmarkService } from "../../bookmark/bookmark.service";

const httpUrl = z
  .string()
  .min(1)
  .max(2000)
  .regex(/^https?:\/\//i, "URL doit commencer par http:// ou https://");

function errorPayload(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) };
}

export function createBookmarkTools(bookmarks: BookmarkService): AgentTool[] {
  return [
    defineTool({
      name: "bookmark_list",
      description: "Liste tous les bookmarks (crookies) sauvegardes. Retourne nom, URL, emoji, categorie, et statut favori.",
      params: z.object({}),
      execute: async () => {
        const all = await bookmarks.getAll();
        return { count: all.length, bookmarks: all };
      },
    }),

    defineTool({
      name: "bookmark_create",
      description: "Cree un nouveau bookmark (crookie).",
      params: z.object({
        name: z.string().min(1).max(255).describe("Nom du bookmark"),
        url: httpUrl.describe("URL du bookmark"),
        emoji: z.string().max(10).optional().describe("Emoji (optionnel)"),
        category: z.string().max(100).optional().describe("Categorie (ex: 'Tech', 'Perso')"),
        isFavorite: z.boolean().optional().describe("Marquer comme favori (defaut: false)"),
      }),
      execute: async ({ name, url, emoji, category, isFavorite }) => {
        try {
          const created = await bookmarks.create({
            name,
            url,
            emoji: emoji ?? null,
            category,
            isFavorite,
          });
          return { created: true, bookmark: created };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "bookmark_update",
      description: "Modifie un bookmark existant. Seuls les champs fournis sont mis a jour.",
      params: z.object({
        id: z.string().min(1).max(100).describe("ID du bookmark"),
        name: z.string().min(1).max(255).optional(),
        url: httpUrl.optional(),
        emoji: z.string().max(10).nullable().optional(),
        category: z.string().max(100).optional(),
        isFavorite: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
      }),
      execute: async ({ id, name, url, emoji, category, isFavorite, sortOrder }) => {
        try {
          const updated = await bookmarks.update(id, {
            ...(name !== undefined && { name }),
            ...(url !== undefined && { url }),
            ...(emoji !== undefined && { emoji }),
            ...(category !== undefined && { category }),
            ...(isFavorite !== undefined && { isFavorite }),
            ...(sortOrder !== undefined && { sortOrder }),
          });
          if (!updated) return { error: `Bookmark introuvable: ${id}` };
          return { updated: true, bookmark: updated };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "bookmark_delete",
      description: "Supprime un bookmark. Action destructive — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        id: z.string().min(1).max(100).describe("ID du bookmark a supprimer"),
      }),
      execute: async ({ id }) => {
        try {
          const ok = await bookmarks.delete(id);
          if (!ok) return { error: `Bookmark introuvable: ${id}` };
          return { deleted: true, id };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "bookmark_categorize",
      description: "Re-categorise un bookmark (raccourci sur bookmark_update qui ne change que la categorie).",
      params: z.object({
        id: z.string().min(1).max(100).describe("ID du bookmark"),
        category: z.string().min(1).max(100).describe("Nouvelle categorie"),
      }),
      execute: async ({ id, category }) => {
        try {
          const updated = await bookmarks.update(id, { category });
          if (!updated) return { error: `Bookmark introuvable: ${id}` };
          return { categorized: true, id, category: updated.category };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),
  ];
}
