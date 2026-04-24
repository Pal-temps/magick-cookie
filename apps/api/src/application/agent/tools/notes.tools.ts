import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { VaultNoteService } from "../../vault-note/vault-note.service";

// Paths are validated by the service via the repo (traversal blocked at boundary).
// We keep the zod shape light so error messages stay readable for the LLM.
const notePath = z
  .string()
  .min(1)
  .max(500)
  .refine((p) => p.replace(/\\/g, "/").endsWith(".md"), {
    message: "path must end with .md",
  });

function errorPayload(err: unknown): { error: string } {
  if (err instanceof Error) return { error: err.message };
  return { error: String(err) };
}

export function createNotesTools(notes: VaultNoteService): AgentTool[] {
  return [
    defineTool({
      name: "notes_list",
      description: "Liste les notes du vault (markdown). Retourne les chemins, taille et date de modification. Recent en premier.",
      params: z.object({
        prefix: z.string().max(500).optional().describe("Sous-dossier a lister (ex: '_ai', 'journal'). Vide = tout le vault."),
        limit: z.number().int().min(1).max(500).optional().describe("Nombre max (defaut 100)"),
      }),
      execute: async ({ prefix, limit }) => {
        try {
          const list = await notes.list({ prefix, limit: limit ?? 100 });
          return { count: list.length, notes: list };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "notes_read",
      description: "Lit le contenu complet d'une note markdown (frontmatter + body).",
      params: z.object({
        path: notePath.describe("Chemin relatif dans le vault (ex: '_ai/idee.md')"),
      }),
      execute: async ({ path }) => {
        try {
          const note = await notes.read(path);
          return {
            path: note.path,
            frontmatter: note.frontmatter,
            body: note.body,
            updatedAt: note.updatedAt,
            sizeBytes: note.sizeBytes,
          };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "notes_create",
      description: "Cree une nouvelle note markdown. Si 'path' est un nom de fichier sans dossier, la note est creee dans '_ai/'. Echoue si le fichier existe deja.",
      params: z.object({
        path: notePath.describe("Chemin ou nom (ex: 'resume.md' → _ai/resume.md, '_ai/idees/x.md' pour explicite)"),
        body: z.string().min(0).max(1_000_000).describe("Contenu markdown (sans frontmatter — passer via 'frontmatter')"),
        frontmatter: z.record(z.string(), z.unknown()).optional().describe("Metadonnees YAML optionnelles"),
      }),
      execute: async ({ path, body, frontmatter }) => {
        try {
          const note = await notes.createForAi({ path, body, frontmatter });
          return { created: true, path: note.path, sizeBytes: note.sizeBytes };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "notes_edit",
      description: "Remplace le body d'une note existante et/ou merge un patch de frontmatter. La note doit exister.",
      params: z.object({
        path: notePath.describe("Chemin complet de la note a modifier"),
        body: z.string().max(1_000_000).optional().describe("Nouveau body (markdown). Si omis, seul le frontmatter est modifie."),
        frontmatter: z.record(z.string(), z.unknown()).optional().describe("Cles a merger (null pour supprimer une cle)"),
      }),
      execute: async ({ path, body, frontmatter }) => {
        if (body === undefined && !frontmatter) {
          return { error: "Provide body and/or frontmatter" };
        }
        try {
          const note = await notes.update(path, { body, frontmatter });
          return { updated: true, path: note.path, sizeBytes: note.sizeBytes };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "notes_append",
      description: "Ajoute du texte a la fin d'une note markdown (preserve le frontmatter). Ideal pour un journal.",
      params: z.object({
        path: notePath.describe("Chemin de la note"),
        text: z.string().min(1).max(1_000_000).describe("Texte a ajouter (sera precede d'un saut de ligne si besoin)"),
      }),
      execute: async ({ path, text }) => {
        try {
          const note = await notes.append(path, text);
          return { appended: true, path: note.path, sizeBytes: note.sizeBytes };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "notes_delete",
      description: "Supprime une note. Action destructive — sera gardee derriere une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        path: notePath.describe("Chemin de la note a supprimer"),
      }),
      execute: async ({ path }) => {
        try {
          await notes.delete(path);
          return { deleted: true, path };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "notes_rename",
      description: "Deplace/renomme une note markdown. Echoue si la cible existe deja.",
      params: z.object({
        oldPath: notePath.describe("Chemin actuel"),
        newPath: notePath.describe("Nouveau chemin"),
      }),
      execute: async ({ oldPath, newPath }) => {
        try {
          const note = await notes.rename(oldPath, newPath);
          return { renamed: true, path: note.path };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),
  ];
}
