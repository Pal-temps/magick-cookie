// GitLab tools — Phase 5 of the AI integration plan.
// Mirrors github.tools.ts but operates on numeric project IDs and MRs (the GitLab
// equivalent of PRs). Permission tiers per the plan:
//   - gitlab_review_mr  user-confirm (visible)
//   - everything else   auto

import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { ProviderService } from "../../provider/provider.service";
import { PROVIDER_NOT_CONFIGURED } from "../../provider/provider.service";

const projectId = z.number().int().min(1).describe("ID numerique du projet GitLab");
const iid = z.number().int().min(1).describe("Numero IID dans le projet");

function errorPayload(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) };
}

export function createGitLabTools(provider: ProviderService): AgentTool[] {
  return [
    defineTool({
      name: "gitlab_list_projects",
      description: "Liste les projets GitLab dont l'utilisateur est membre (tries par derniere activite).",
      params: z.object({
        membership: z.boolean().optional().describe("True (defaut) = projets dont l'utilisateur est membre, false = tous les projets visibles"),
      }),
      execute: async ({ membership }) => {
        const client = await provider.getGitLabClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("gitlab");
        try {
          const projects = await client.listProjects(membership ?? true);
          return { count: projects.length, projects };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "gitlab_create_issue",
      description: "Cree une issue GitLab dans un projet.",
      params: z.object({
        projectId,
        title: z.string().min(1).max(500),
        description: z.string().max(65_536).optional(),
        labels: z.array(z.string().min(1).max(100)).max(20).optional(),
        assigneeIds: z.array(z.number().int().min(1)).max(10).optional().describe("IDs numeriques GitLab des assignees"),
      }),
      execute: async ({ projectId, title, description, labels, assigneeIds }) => {
        const client = await provider.getGitLabClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("gitlab");
        try {
          const issue = await client.createIssue(projectId, { title, description, labels, assigneeIds });
          return { created: true, projectId, iid: issue.iid, url: issue.webUrl };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "gitlab_close_issue",
      description: "Ferme une issue GitLab (state_event=close).",
      params: z.object({ projectId, iid }),
      execute: async ({ projectId, iid }) => {
        const client = await provider.getGitLabClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("gitlab");
        try {
          await client.closeIssue(projectId, iid);
          return { closed: true, projectId, iid };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "gitlab_add_comment",
      description: "Ajoute un commentaire (note) sur une issue GitLab.",
      params: z.object({
        projectId,
        iid,
        body: z.string().min(1).max(65_536),
      }),
      execute: async ({ projectId, iid, body }) => {
        const client = await provider.getGitLabClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("gitlab");
        try {
          const note = await client.addIssueComment(projectId, iid, body);
          return { added: true, noteId: note.id };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "gitlab_trigger_pipeline",
      description: "Declenche un pipeline GitLab CI sur une branche/tag, avec variables CI optionnelles.",
      params: z.object({
        projectId,
        ref: z.string().min(1).max(255),
        variables: z.record(z.string().max(100), z.string().max(1000)).optional(),
      }),
      execute: async ({ projectId, ref, variables }) => {
        const client = await provider.getGitLabClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("gitlab");
        try {
          const pipeline = await client.triggerPipeline(projectId, ref, variables);
          return { triggered: true, pipelineId: pipeline.id, url: pipeline.webUrl };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "gitlab_list_mrs",
      description: "Liste les merge requests d'un projet. State: 'opened' (defaut), 'closed', 'merged', 'all'.",
      params: z.object({
        projectId,
        state: z.enum(["opened", "closed", "merged", "all"]).optional(),
      }),
      execute: async ({ projectId, state }) => {
        const client = await provider.getGitLabClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("gitlab");
        try {
          const mrs = await client.listMergeRequests(projectId, state ?? "opened");
          return { count: mrs.length, mergeRequests: mrs };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "gitlab_review_mr",
      description: "Soumet une review sur une MR GitLab : poste un commentaire, et optionnellement approuve la MR. Action visible publiquement — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        projectId,
        iid,
        body: z.string().min(1).max(65_536).describe("Corps de la review (commentaire global)"),
        approve: z.boolean().optional().describe("True = approuver la MR apres avoir poste le commentaire"),
      }),
      execute: async ({ projectId, iid, body, approve }) => {
        const client = await provider.getGitLabClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("gitlab");
        try {
          const result = await client.reviewMergeRequest(projectId, iid, body, approve ?? false);
          return { reviewed: true, projectId, iid, ...result };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),
  ];
}
