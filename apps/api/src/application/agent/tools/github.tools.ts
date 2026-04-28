// GitHub tools — Phase 5 of the AI integration plan.
// Wraps the GitHubApiClient via ProviderService — no token management here.
// Permission tiers per the plan:
//   - github_review_pr   user-confirm (visible to others)
//   - everything else    auto

import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { ProviderService } from "../../provider/provider.service";
import { PROVIDER_NOT_CONFIGURED } from "../../provider/provider.service";
import type { GitHubReviewEvent } from "../../../infrastructure/connectors/github-api.client";

const repoSlug = z
  .string()
  .min(3)
  .max(140)
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Format attendu owner/repo");

const REVIEW_EVENTS = ["APPROVE", "REQUEST_CHANGES", "COMMENT"] as const;

function errorPayload(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) };
}

export function createGitHubTools(provider: ProviderService): AgentTool[] {
  return [
    defineTool({
      name: "github_list_repos",
      description: "Liste les repos GitHub accessibles a l'utilisateur authentifie (proprietaire + collaborateur). Tries par derniere modification.",
      params: z.object({}),
      execute: async () => {
        const client = await provider.getGitHubClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("github");
        try {
          const repos = await client.listRepos();
          return { count: repos.length, repos };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "github_create_issue",
      description: "Cree une issue GitHub dans un repo donne.",
      params: z.object({
        repo: repoSlug.describe("Slug owner/repo (ex: 'cli/cli')"),
        title: z.string().min(1).max(500).describe("Titre de l'issue"),
        body: z.string().max(65_536).optional().describe("Corps markdown"),
        labels: z.array(z.string().min(1).max(100)).max(20).optional(),
        assignees: z.array(z.string().min(1).max(100)).max(10).optional(),
      }),
      execute: async ({ repo, title, body, labels, assignees }) => {
        const client = await provider.getGitHubClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("github");
        try {
          const issue = await client.createIssue(repo, { title, body, labels, assignees });
          return { created: true, repo, number: issue.number, url: issue.url };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "github_close_issue",
      description: "Ferme une issue GitHub (state=closed).",
      params: z.object({
        repo: repoSlug,
        number: z.number().int().min(1).describe("Numero d'issue"),
      }),
      execute: async ({ repo, number }) => {
        const client = await provider.getGitHubClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("github");
        try {
          await client.closeIssue(repo, number);
          return { closed: true, repo, number };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "github_add_comment",
      description: "Ajoute un commentaire sur une issue ou PR GitHub (meme endpoint cote API).",
      params: z.object({
        repo: repoSlug,
        number: z.number().int().min(1).describe("Numero de l'issue ou PR"),
        body: z.string().min(1).max(65_536).describe("Corps markdown du commentaire"),
      }),
      execute: async ({ repo, number, body }) => {
        const client = await provider.getGitHubClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("github");
        try {
          const comment = await client.addIssueComment(repo, number, body);
          return { added: true, commentId: comment.id, url: comment.url };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "github_trigger_workflow",
      description: "Declenche un workflow GitHub Actions (workflow_dispatch). 'workflowId' peut etre un nom de fichier (ex: 'deploy.yml') ou un id numerique.",
      params: z.object({
        repo: repoSlug,
        workflowId: z.string().min(1).max(255).describe("Nom de fichier ou ID numerique"),
        ref: z.string().min(1).max(255).describe("Branche ou tag (ex: 'main')"),
        inputs: z.record(z.string().max(100), z.string().max(1000)).optional().describe("Inputs declares dans le workflow"),
      }),
      execute: async ({ repo, workflowId, ref, inputs }) => {
        const client = await provider.getGitHubClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("github");
        try {
          await client.triggerWorkflow(repo, workflowId, ref, inputs);
          return { triggered: true, repo, workflowId, ref };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "github_list_prs",
      description: "Liste les pull requests d'un repo. State: 'open' (defaut), 'closed', ou 'all'.",
      params: z.object({
        repo: repoSlug,
        state: z.enum(["open", "closed", "all"]).optional(),
      }),
      execute: async ({ repo, state }) => {
        const client = await provider.getGitHubClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("github");
        try {
          const prs = await client.listPullRequests(repo, state ?? "open");
          return { count: prs.length, prs };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),

    defineTool({
      name: "github_review_pr",
      description: "Soumet une review sur une PR GitHub. event=APPROVE/REQUEST_CHANGES/COMMENT. Action visible publiquement — exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        repo: repoSlug,
        number: z.number().int().min(1),
        event: z.enum(REVIEW_EVENTS),
        body: z.string().max(65_536).optional().describe("Corps markdown (requis si REQUEST_CHANGES)"),
      }),
      execute: async ({ repo, number, event, body }) => {
        if (event === "REQUEST_CHANGES" && !body) {
          return { error: "body requis quand event=REQUEST_CHANGES" };
        }
        const client = await provider.getGitHubClient();
        if (!client) return PROVIDER_NOT_CONFIGURED("github");
        try {
          const review = await client.reviewPullRequest(repo, number, event as GitHubReviewEvent, body);
          return { reviewed: true, repo, number, event, reviewId: review.id };
        } catch (err) {
          return errorPayload(err);
        }
      },
    }),
  ];
}
