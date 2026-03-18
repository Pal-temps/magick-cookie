import type { AgentTool } from "../tool-registry";
import type { BriefService } from "../../brief/brief.service";
import type { EmailService } from "../../email/email.service";
import type { LlmService } from "../../llm/llm.service";
import type { EventService } from "../../event/event.service";
import type { BookmarkService } from "../../bookmark/bookmark.service";
import type { ProjectService } from "../../project/project.service";

const EMAIL_CATEGORIES = ["newsletter", "facture", "action_requise", "personnel", "notification", "autre"];

export function createBriefTools(briefService: BriefService): AgentTool[] {
  return [
    {
      name: "generate_brief",
      description: "Genere le brief quotidien : resume d'hier, plan d'aujourd'hui, blocages. Si le LLM est configure, genere un texte narratif.",
      parameters: {
        date: { type: "string", description: "Date YYYY-MM-DD (defaut : aujourd'hui)", required: false },
      },
      execute: async (params) => {
        const date = params.date ? new Date(params.date as string) : new Date();
        return briefService.generate(date);
      },
    },
  ];
}

export function createEmailTools(emailService: EmailService, llmService?: LlmService): AgentTool[] {
  return [
    {
      name: "get_unread_email_count",
      description: "Compte le nombre d'emails non lus",
      parameters: {},
      execute: async () => {
        const count = await emailService.getUnreadCount();
        return { unreadCount: count };
      },
    },
    {
      name: "sync_emails",
      description: "Lance une synchronisation des emails",
      parameters: {},
      execute: async () => {
        await emailService.syncAll();
        return { success: true, message: "Synchronisation lancee" };
      },
    },
    {
      name: "classify_email",
      description: "Classe un email dans une categorie (newsletter, facture, action_requise, personnel, notification, autre)",
      parameters: {
        emailId: { type: "string", description: "ID de l'email a classifier", required: true },
      },
      execute: async (params) => {
        if (!llmService) return { error: "LLM non configure" };
        const email = await emailService.getEmailById(params.emailId as string);
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
    },
  ];
}

export function createCalendarTools(eventService: EventService): AgentTool[] {
  return [
    {
      name: "get_events_today",
      description: "Liste les evenements du calendrier pour aujourd'hui",
      parameters: {},
      execute: async () => {
        const now = new Date();
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const end = new Date(now); end.setHours(23, 59, 59, 999);
        return eventService.getAll({ from: start, to: end });
      },
    },
    {
      name: "get_events",
      description: "Liste les evenements du calendrier sur une periode",
      parameters: {
        from: { type: "string", description: "Date debut YYYY-MM-DD", required: true },
        to: { type: "string", description: "Date fin YYYY-MM-DD", required: true },
      },
      execute: async (params) => {
        const from = new Date(params.from as string);
        const to = new Date((params.to as string) + "T23:59:59");
        return eventService.getAll({ from, to });
      },
    },
  ];
}

export function createBookmarkTools(bookmarkService: BookmarkService): AgentTool[] {
  return [
    {
      name: "list_bookmarks",
      description: "Liste tous les signets/bookmarks sauvegardes",
      parameters: {},
      execute: async () => bookmarkService.getAll(),
    },
    {
      name: "create_bookmark",
      description: "Cree un nouveau signet/bookmark",
      parameters: {
        name: { type: "string", description: "Nom du bookmark", required: true },
        url: { type: "string", description: "URL du bookmark", required: true },
        emoji: { type: "string", description: "Emoji (optionnel)", required: false },
      },
      execute: async (params) => {
        return bookmarkService.create({
          name: params.name as string,
          url: params.url as string,
          emoji: (params.emoji as string) || null,
        });
      },
    },
  ];
}

export function createProjectTools(projectService: ProjectService): AgentTool[] {
  return [
    {
      name: "list_projects",
      description: "Liste tous les projets",
      parameters: {},
      execute: async () => projectService.getAll(),
    },
    {
      name: "create_project",
      description: "Cree un nouveau projet",
      parameters: {
        name: { type: "string", description: "Nom du projet", required: true },
        color: { type: "string", description: "Couleur hex (ex: #6c5ce7)", required: false },
      },
      execute: async (params) => {
        return projectService.create({
          name: params.name as string,
          color: (params.color as string) || undefined,
        });
      },
    },
  ];
}
