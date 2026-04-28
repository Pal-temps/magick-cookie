// Email action tools — Phase 4.2 of the AI integration plan.
// Read-only email tools (count, sync, classify, digest) live in brief.tools.ts —
// this file is purely for actions that modify mailbox state.
//
// Permission tiers per the plan:
//   - email_send         user-confirm (irreversible outbound)
//   - email_delete       user-confirm (destructive, single)
//   - email_bulk_delete  admin        (destructive, fan-out)
//   - everything else    auto         (mailbox-internal, reversible)

import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { EmailService } from "../../email/email.service";

const emailAddress = z
  .string()
  .min(3)
  .max(320)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Adresse email invalide");

const recipients = z.array(emailAddress).min(1).max(50);

function errorPayload(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) };
}

export function createEmailActionTools(emailService: EmailService): AgentTool[] {
  return [
    defineTool({
      name: "email_compose",
      description: "Prepare un email (preview avant envoi). Retourne le contenu structure sans rien envoyer. L'utilisateur doit appeler email_send pour declencher l'envoi.",
      params: z.object({
        accountId: z.string().min(1).max(100).describe("ID du compte email expediteur"),
        to: recipients.describe("Liste des destinataires"),
        cc: z.array(emailAddress).max(50).optional().describe("Copie carbone (optionnel)"),
        subject: z.string().min(1).max(998).describe("Sujet"),
        bodyText: z.string().max(100_000).describe("Corps texte"),
        bodyHtml: z.string().max(500_000).optional().describe("Corps HTML (optionnel)"),
      }),
      execute: async ({ accountId, to, cc, subject, bodyText, bodyHtml }) => {
        // Surface the assembled draft so the LLM/UI can show a preview before email_send.
        return {
          draft: { accountId, to, cc: cc ?? [], subject, bodyText, bodyHtml: bodyHtml ?? null },
          ready: true,
        };
      },
    }),

    defineTool({
      name: "email_send",
      description: "Envoie un email. Action irreversible — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        accountId: z.string().min(1).max(100).describe("ID du compte email expediteur"),
        to: recipients,
        cc: z.array(emailAddress).max(50).optional(),
        subject: z.string().min(1).max(998),
        bodyText: z.string().max(100_000),
        bodyHtml: z.string().max(500_000).optional(),
      }),
      execute: async ({ accountId, to, cc, subject, bodyText, bodyHtml }) => {
        try {
          const sent = await emailService.sendEmail(accountId, { to, cc, subject, bodyText, bodyHtml });
          if (!sent) return { sent: false, error: "Echec d'envoi" };
          return { sent: true, id: sent.id, sentAt: sent.sentAt };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "email_reply",
      description: "Repond a un email existant. Reprend automatiquement l'expediteur et le sujet (prefixe Re:). Action irreversible — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        emailId: z.string().min(1).max(100).describe("ID de l'email auquel repondre"),
        bodyText: z.string().min(1).max(100_000).describe("Corps de la reponse"),
        bodyHtml: z.string().max(500_000).optional().describe("Corps HTML (optionnel)"),
        replyAll: z.boolean().optional().describe("Inclure les destinataires en CC (defaut: false)"),
      }),
      execute: async ({ emailId, bodyText, bodyHtml, replyAll }) => {
        try {
          const original = await emailService.getEmailById(emailId);
          if (!original) return { error: `Email introuvable: ${emailId}` };

          const subject = original.subject?.startsWith("Re:") ? original.subject : `Re: ${original.subject ?? ""}`;
          const cc = replyAll
            ? original.ccAddresses.map((a) => a.address).filter(Boolean)
            : undefined;

          const sent = await emailService.sendEmail(original.accountId, {
            to: [original.fromAddress],
            cc,
            subject,
            bodyText,
            bodyHtml,
          });
          if (!sent) return { sent: false, error: "Echec d'envoi" };
          return { sent: true, id: sent.id, replyTo: original.fromAddress, subject };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "email_mark_read",
      description: "Marque un email comme lu (ou non lu).",
      params: z.object({
        emailId: z.string().min(1).max(100).describe("ID de l'email"),
        isRead: z.boolean().optional().describe("True (lu, defaut) ou false (non lu)"),
      }),
      execute: async ({ emailId, isRead }) => {
        try {
          const updated = await emailService.updateEmailFlags(emailId, { isRead: isRead ?? true });
          if (!updated) return { error: `Email introuvable: ${emailId}` };
          return { updated: true, isRead: updated.isRead };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "email_star",
      description: "Marque ou de-marque un email comme important (etoile).",
      params: z.object({
        emailId: z.string().min(1).max(100).describe("ID de l'email"),
        isStarred: z.boolean().optional().describe("True (etoile, defaut) ou false (retirer)"),
      }),
      execute: async ({ emailId, isStarred }) => {
        try {
          const updated = await emailService.updateEmailFlags(emailId, { isStarred: isStarred ?? true });
          if (!updated) return { error: `Email introuvable: ${emailId}` };
          return { updated: true, isStarred: updated.isStarred };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "email_move",
      description: "Deplace un email vers un autre dossier IMAP (ex: 'Archive', 'Trash', 'Suivi').",
      params: z.object({
        emailId: z.string().min(1).max(100).describe("ID de l'email"),
        targetFolder: z.string().min(1).max(255).describe("Dossier cible (nom IMAP exact)"),
      }),
      execute: async ({ emailId, targetFolder }) => {
        try {
          const moved = await emailService.moveEmail(emailId, targetFolder);
          if (!moved) return { error: `Email introuvable: ${emailId}` };
          return { moved: true, folder: moved.folder };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "email_delete",
      description: "Supprime un email (move to Trash cote IMAP). Action destructive — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        emailId: z.string().min(1).max(100).describe("ID de l'email a supprimer"),
      }),
      execute: async ({ emailId }) => {
        try {
          // Capture email state before deletion for undo token.
          const snapshot = await emailService.getEmailById(emailId);
          const ok = await emailService.deleteEmail(emailId);
          if (!ok) return { error: `Email introuvable ou suppression IMAP echouee: ${emailId}` };
          const undoToken = snapshot
            ? JSON.stringify({ id: snapshot.id, subject: snapshot.subject, from: snapshot.from, folder: snapshot.folder, accountId: snapshot.accountId })
            : null;
          return { deleted: true, id: emailId, _undoToken: undoToken };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "email_bulk_delete",
      description: "Supprime plusieurs emails en une operation. Cap a 100 ids par appel. Action destructive de masse — exige les permissions admin.",
      permissionLevel: "admin",
      params: z.object({
        emailIds: z.array(z.string().min(1).max(100)).min(1).max(100).describe("Liste des IDs (1 a 100)"),
      }),
      execute: async ({ emailIds }) => {
        try {
          const count = await emailService.bulkDeleteEmails(emailIds);
          return { deleted: count, requested: emailIds.length };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),
  ];
}
