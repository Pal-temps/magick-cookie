import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import { resolveCli } from "../../../infrastructure/cli/cli-resolver";
import type { ProviderService } from "../../provider/provider.service";
import { PROVIDER_NOT_CONFIGURED } from "../../provider/provider.service";

const repoSlug = z.string().min(1).max(200).regex(/^[\w.-]+\/[\w.-]+$/, "Format: owner/repo");

async function runGh(
  args: string[],
  token: string,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const bin = resolveCli("gh");
  if (!bin) {
    return { ok: false, error: "gh CLI non installé — va dans Paramètres › DevOps CLI pour l'installer." };
  }

  const proc = Bun.spawn([bin, ...args], {
    env: { ...process.env, GH_TOKEN: token, NO_COLOR: "1", GH_NO_UPDATE_NOTIFIER: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (code !== 0) return { ok: false, error: stderr.trim().slice(0, 1000) };

  try {
    return { ok: true, data: JSON.parse(stdout) };
  } catch {
    return { ok: true, data: stdout.trim() };
  }
}

export function createGhCliTools(provider: ProviderService): AgentTool[] {
  return [
    defineTool({
      name: "gh_run_list",
      description: "Liste les derniers workflow runs CI/CD d'un repo GitHub via le CLI gh installé localement.",
      params: z.object({
        repo: repoSlug.describe("Slug owner/repo (ex: 'cli/cli')"),
        limit: z.number().int().min(1).max(50).optional().describe("Nombre de runs à retourner (défaut: 10)"),
        branch: z.string().max(255).optional().describe("Filtrer par branche"),
        workflow: z.string().max(255).optional().describe("Filtrer par nom de workflow"),
      }),
      execute: async ({ repo, limit = 10, branch, workflow }) => {
        const token = await provider.getGitHubToken();
        if (!token) return PROVIDER_NOT_CONFIGURED("github");

        const args = ["run", "list", "--repo", repo, "--limit", String(limit),
          "--json", "status,conclusion,name,displayTitle,headBranch,workflowName,createdAt,url,databaseId"];
        if (branch) args.push("--branch", branch);
        if (workflow) args.push("--workflow", workflow);

        const res = await runGh(args, token);
        if (!res.ok) return { error: res.error };
        return { repo, runs: res.data };
      },
    }),

    defineTool({
      name: "gh_pr_list",
      description: "Liste les pull requests d'un repo GitHub via le CLI gh.",
      params: z.object({
        repo: repoSlug.describe("Slug owner/repo"),
        state: z.enum(["open", "closed", "merged", "all"]).optional().describe("État (défaut: open)"),
        limit: z.number().int().min(1).max(100).optional().describe("Nombre de PRs (défaut: 20)"),
        author: z.string().max(100).optional().describe("Filtrer par auteur GitHub"),
      }),
      execute: async ({ repo, state = "open", limit = 20, author }) => {
        const token = await provider.getGitHubToken();
        if (!token) return PROVIDER_NOT_CONFIGURED("github");

        const args = ["pr", "list", "--repo", repo, "--state", state, "--limit", String(limit),
          "--json", "number,title,author,createdAt,updatedAt,url,isDraft,headRefName,labels"];
        if (author) args.push("--author", author);

        const res = await runGh(args, token);
        if (!res.ok) return { error: res.error };
        return { repo, state, prs: res.data };
      },
    }),

    defineTool({
      name: "gh_pr_view",
      description: "Affiche les détails d'une pull request GitHub (titre, corps, statut, reviews).",
      params: z.object({
        repo: repoSlug.describe("Slug owner/repo"),
        number: z.number().int().min(1).describe("Numéro de la PR"),
      }),
      execute: async ({ repo, number }) => {
        const token = await provider.getGitHubToken();
        if (!token) return PROVIDER_NOT_CONFIGURED("github");

        const res = await runGh(
          ["pr", "view", String(number), "--repo", repo,
            "--json", "number,title,body,author,state,createdAt,updatedAt,url,isDraft,headRefName,baseRefName,labels,reviewDecision,statusCheckRollup"],
          token,
        );
        if (!res.ok) return { error: res.error };
        return { repo, pr: res.data };
      },
    }),

    defineTool({
      name: "gh_issue_list",
      description: "Liste les issues d'un repo GitHub.",
      params: z.object({
        repo: repoSlug.describe("Slug owner/repo"),
        state: z.enum(["open", "closed", "all"]).optional().describe("État (défaut: open)"),
        limit: z.number().int().min(1).max(100).optional().describe("Nombre d'issues (défaut: 20)"),
        labels: z.array(z.string().max(100)).max(10).optional().describe("Filtrer par labels"),
        assignee: z.string().max(100).optional().describe("Filtrer par assigné"),
      }),
      execute: async ({ repo, state = "open", limit = 20, labels, assignee }) => {
        const token = await provider.getGitHubToken();
        if (!token) return PROVIDER_NOT_CONFIGURED("github");

        const args = ["issue", "list", "--repo", repo, "--state", state, "--limit", String(limit),
          "--json", "number,title,author,assignees,labels,createdAt,updatedAt,url,milestone"];
        if (labels?.length) args.push("--label", labels.join(","));
        if (assignee) args.push("--assignee", assignee);

        const res = await runGh(args, token);
        if (!res.ok) return { error: res.error };
        return { repo, state, issues: res.data };
      },
    }),
  ];
}
