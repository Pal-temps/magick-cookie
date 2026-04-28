// RSS management tools — Phase 4.3 of the AI integration plan.
// Wraps RssService — no business logic here. Permission tiers per the plan:
//   - rss_remove_feed   user-confirm (destructive: drops every article in cascade)
//   - everything else   auto

import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { RssService } from "../../rss/rss.service";

const httpUrl = z
  .string()
  .min(1)
  .max(2000)
  .regex(/^https?:\/\//i, "URL doit commencer par http:// ou https://");

function errorPayload(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) };
}

export function createRssTools(rss: RssService): AgentTool[] {
  return [
    defineTool({
      name: "rss_add_feed",
      description: "Ajoute un nouveau flux RSS. La premiere synchronisation est lancee en arriere-plan.",
      params: z.object({
        label: z.string().min(1).max(255).describe("Nom court du flux (ex: 'Hacker News')"),
        url: httpUrl.describe("URL du flux RSS/Atom"),
        category: z.string().max(100).optional().describe("Categorie (ex: 'Tech', 'News')"),
      }),
      execute: async ({ label, url, category }) => {
        try {
          const feed = await rss.createFeed({ label, url, category });
          return { added: true, feed };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "rss_remove_feed",
      description: "Supprime un flux RSS et tous ses articles (cascade DB). Action destructive — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        feedId: z.string().min(1).max(100).describe("ID du flux a supprimer"),
      }),
      execute: async ({ feedId }) => {
        try {
          const ok = await rss.deleteFeed(feedId);
          if (!ok) return { error: `Flux introuvable: ${feedId}` };
          return { deleted: true, feedId };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "rss_star",
      description: "Marque ou de-marque un article RSS comme important (etoile).",
      params: z.object({
        articleId: z.string().min(1).max(100).describe("ID de l'article"),
        isStarred: z.boolean().optional().describe("True (etoile, defaut) ou false (retirer)"),
      }),
      execute: async ({ articleId, isStarred }) => {
        try {
          const updated = await rss.updateArticleFlags(articleId, { isStarred: isStarred ?? true });
          if (!updated) return { error: `Article introuvable: ${articleId}` };
          return { updated: true, isStarred: updated.isStarred };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "rss_mark_read",
      description: "Marque un article RSS comme lu (ou non lu).",
      params: z.object({
        articleId: z.string().min(1).max(100).describe("ID de l'article"),
        isRead: z.boolean().optional().describe("True (lu, defaut) ou false (non lu)"),
      }),
      execute: async ({ articleId, isRead }) => {
        try {
          const updated = await rss.updateArticleFlags(articleId, { isRead: isRead ?? true });
          if (!updated) return { error: `Article introuvable: ${articleId}` };
          return { updated: true, isRead: updated.isRead };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "rss_mark_all_read",
      description: "Marque tous les articles d'un flux comme lus. Retourne le nombre d'articles affectes.",
      params: z.object({
        feedId: z.string().min(1).max(100).describe("ID du flux"),
      }),
      execute: async ({ feedId }) => {
        try {
          const count = await rss.markAllRead(feedId);
          return { markedRead: count, feedId };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "rss_generate_digest",
      description: "Genere un digest LLM des articles RSS non lus des 24 dernieres heures (highlights, resume, categories). Necessite que le LLM soit configure.",
      params: z.object({}),
      execute: async () => {
        try {
          const digest = await rss.generateDigest();
          return digest;
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),
  ];
}
