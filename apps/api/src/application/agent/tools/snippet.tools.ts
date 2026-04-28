// Snippet tools — Phase 4.5 of the AI integration plan.
// Wraps SnippetService — full CRUD + tag search. Permission tiers:
//   - snippet_delete  user-confirm (destructive)
//   - everything else auto

import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { SnippetService } from "../../snippet/snippet.service";

function errorPayload(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) };
}

export function createSnippetTools(snippets: SnippetService): AgentTool[] {
  return [
    defineTool({
      name: "snippet_list",
      description: "Liste les snippets de code. Filtres optionnels par langage et limite.",
      params: z.object({
        language: z.string().min(1).max(50).optional().describe("Filtrer par langage (ex: 'typescript', 'rust')"),
        limit: z.number().int().min(1).max(500).optional().describe("Nombre max (defaut 100)"),
      }),
      execute: async ({ language, limit }) => {
        const all = await snippets.getAll({ language, limit: limit ?? 100 });
        return { count: all.length, snippets: all };
      },
    }),

    defineTool({
      name: "snippet_create",
      description: "Cree un nouveau snippet de code.",
      params: z.object({
        title: z.string().min(1).max(255).describe("Titre court du snippet"),
        content: z.string().min(1).max(1_000_000).describe("Contenu du snippet"),
        language: z.string().min(1).max(50).optional().describe("Langage (ex: 'typescript')"),
        tags: z.array(z.string().min(1).max(50)).max(20).optional().describe("Tags (max 20)"),
        isFavorite: z.boolean().optional().describe("Marquer comme favori"),
      }),
      execute: async ({ title, content, language, tags, isFavorite }) => {
        try {
          const created = await snippets.create({ title, content, language, tags, isFavorite });
          return { created: true, snippet: created };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "snippet_update",
      description: "Modifie un snippet. Seuls les champs fournis sont mis a jour.",
      params: z.object({
        id: z.string().min(1).max(100).describe("ID du snippet"),
        title: z.string().min(1).max(255).optional(),
        content: z.string().min(1).max(1_000_000).optional(),
        language: z.string().min(1).max(50).optional(),
        tags: z.array(z.string().min(1).max(50)).max(20).optional(),
        isFavorite: z.boolean().optional(),
      }),
      execute: async ({ id, title, content, language, tags, isFavorite }) => {
        try {
          const updated = await snippets.update(id, {
            ...(title !== undefined && { title }),
            ...(content !== undefined && { content }),
            ...(language !== undefined && { language }),
            ...(tags !== undefined && { tags }),
            ...(isFavorite !== undefined && { isFavorite }),
          });
          if (!updated) return { error: `Snippet introuvable: ${id}` };
          return { updated: true, snippet: updated };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "snippet_delete",
      description: "Supprime un snippet. Action destructive — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        id: z.string().min(1).max(100).describe("ID du snippet a supprimer"),
      }),
      execute: async ({ id }) => {
        try {
          const ok = await snippets.delete(id);
          if (!ok) return { error: `Snippet introuvable: ${id}` };
          return { deleted: true, id };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "snippet_search_by_tag",
      description: "Liste les snippets associes a un tag (filtre cote service).",
      params: z.object({
        tag: z.string().min(1).max(50).describe("Tag a chercher (correspondance exacte)"),
        limit: z.number().int().min(1).max(500).optional().describe("Nombre max (defaut 100)"),
      }),
      execute: async ({ tag, limit }) => {
        const found = await snippets.getAll({ tag, limit: limit ?? 100 });
        return { tag, count: found.length, snippets: found };
      },
    }),
  ];
}
