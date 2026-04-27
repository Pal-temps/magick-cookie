import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { BriefService } from "../../brief/brief.service";
import type { EmailService } from "../../email/email.service";
import type { LlmService } from "../../llm/llm.service";
import type { BookmarkService } from "../../bookmark/bookmark.service";
import type { ProjectService } from "../../project/project.service";

const EMAIL_CATEGORIES = ["newsletter", "facture", "action_requise", "personnel", "notification", "autre"];
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu YYYY-MM-DD");

export function createBriefTools(briefService: BriefService): AgentTool[] {
  return [
    defineTool({
      name: "generate_brief",
      description: "Genere le brief quotidien : resume d'hier, plan d'aujourd'hui, blocages. Si le LLM est configure, genere un texte narratif.",
      params: z.object({
        date: isoDate.optional().describe("Date YYYY-MM-DD (defaut : aujourd'hui)"),
      }),
      execute: async ({ date }) => briefService.generate(date ? new Date(date) : new Date()),
    }),
  ];
}

export function createEmailTools(emailService: EmailService, llmService?: LlmService): AgentTool[] {
  return [
    defineTool({
      name: "get_unread_email_count",
      description: "Compte le nombre d'emails non lus",
      params: z.object({}),
      execute: async () => {
        const count = await emailService.getUnreadCount();
        return { unreadCount: count };
      },
    }),
    defineTool({
      name: "sync_emails",
      description: "Lance une synchronisation des emails",
      params: z.object({}),
      execute: async () => {
        await emailService.syncAll();
        return { success: true, message: "Synchronisation lancee" };
      },
    }),
    defineTool({
      name: "classify_email",
      description: "Classe un email dans une categorie (newsletter, facture, action_requise, personnel, notification, autre)",
      params: z.object({
        emailId: z.string().min(1).describe("ID de l'email a classifier"),
      }),
      execute: async ({ emailId }) => {
        if (!llmService) return { error: "LLM non configure" };
        const email = await emailService.getEmailById(emailId);
        if (!email) return { error: "Email non trouve" };
        if (email.classification) return { classification: email.classification, cached: true };

        let text = email.bodyText || "";
        if (!text && email.bodyHtml) {
          text = email.bodyHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        }
        if (!text) return { error: "Email sans contenu" };

        const classification = await llmService.classify(
          `Sujet: ${email.subject || "(sans sujet)"}\nDe: ${email.fromName || email.fromAddress}\n\n${text.substring(0, 1000)}`,
          EMAIL_CATEGORIES,
        );
        await emailService.updateSummary(email.id, email.summary || "", classification);
        return { classification, cached: false };
      },
    }),
  ];
}

export function createBookmarkTools(bookmarkService: BookmarkService): AgentTool[] {
  return [
    defineTool({
      name: "list_bookmarks",
      description: "Liste tous les signets/bookmarks sauvegardes",
      params: z.object({}),
      execute: async () => bookmarkService.getAll(),
    }),
    defineTool({
      name: "create_bookmark",
      description: "Cree un nouveau signet/bookmark",
      params: z.object({
        name: z.string().min(1).max(255).describe("Nom du bookmark"),
        url: z.string().min(1).max(1000).describe("URL du bookmark"),
        emoji: z.string().max(10).optional().describe("Emoji (optionnel)"),
      }),
      execute: async ({ name, url, emoji }) => {
        return bookmarkService.create({ name, url, emoji: emoji ?? null });
      },
    }),
  ];
}

export function createProjectTools(projectService: ProjectService): AgentTool[] {
  return [
    defineTool({
      name: "list_projects",
      description: "Liste tous les projets",
      params: z.object({}),
      execute: async () => projectService.getAll(),
    }),
    defineTool({
      name: "create_project",
      description: "Cree un nouveau projet",
      params: z.object({
        name: z.string().min(1).max(255).describe("Nom du projet"),
        color: z.string().optional().describe("Couleur hex (ex: #6c5ce7)"),
      }),
      execute: async ({ name, color }) => {
        return projectService.create({ name, color: color ?? undefined });
      },
    }),
  ];
}
