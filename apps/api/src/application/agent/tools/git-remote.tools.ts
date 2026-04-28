import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { GitRemoteService, GitRemoteProvider } from "../../../infrastructure/git-remote/git-remote.service";

const PROVIDERS = ["vps-bare", "github", "gitlab"] as const;

export function createGitRemoteTools(gitRemote: GitRemoteService): AgentTool[] {
  return [
    defineTool({
      name: "git_remote_providers",
      description: "Liste les providers git disponibles (vps-bare, github, gitlab). vps-bare cree un repo directement sur le serveur avec un hook post-receive pour auto-deploy.",
      params: z.object({}),
      execute: async () => ({ providers: gitRemote.availableProviders() }),
    }),
    defineTool({
      name: "git_remote_list",
      description: "Liste tous les repos git sur tous les providers configures.",
      params: z.object({}),
      execute: async () => {
        const repos = await gitRemote.listRepos();
        return { count: repos.length, repos };
      },
    }),
    defineTool({
      name: "git_remote_create",
      description: "Cree un nouveau repo git. Pour 'vps-bare', cree un bare repo sur le serveur avec un hook post-receive qui auto-deploy a chaque push. Pour 'github'/'gitlab', cree un repo sur la plateforme. Side-effect significatif (auto-deploy possible): exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        provider: z.enum(PROVIDERS).describe("Provider: 'vps-bare' (recommande, auto-deploy), 'github', ou 'gitlab'"),
        name: z.string().min(1).max(140).describe("Nom du repo (ex: 'mon-app')"),
        server_id: z.string().optional().describe("ID du serveur (requis pour vps-bare)"),
        build_command: z.string().max(1000).optional().describe("Commande de build pour le hook post-receive (defaut: npm install && npm run build)"),
        start_command: z.string().max(1000).optional().describe("Commande de demarrage (defaut: pm2 restart {name})"),
        description: z.string().max(1000).optional().describe("Description du repo (github/gitlab)"),
        private: z.boolean().optional().describe("Repo prive (defaut: true)"),
      }),
      execute: async ({ provider, name, server_id, build_command, start_command, description, private: isPrivate }) => {
        const repo = await gitRemote.createRepo(provider as GitRemoteProvider, {
          name,
          serverId: server_id,
          buildCommand: build_command,
          startCommand: start_command,
          description,
          private: isPrivate,
        });
        return {
          created: true,
          repo,
          instructions: repo.provider === "vps-bare"
            ? `Repo cree. Pour deployer:\n  git remote add vps ${repo.cloneUrl}\n  git push vps main\nLe hook post-receive va automatiquement builder et redemarrer l'app.`
            : `Repo cree sur ${repo.provider}. URL: ${repo.webUrl ?? repo.cloneUrl}`,
        };
      },
    }),
    defineTool({
      name: "git_remote_delete",
      description: "Supprime un repo git et ses fichiers associes (app + hook pour vps-bare). Action destructive: exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        provider: z.enum(PROVIDERS).describe("Provider du repo"),
        name: z.string().min(1).max(140).describe("Nom du repo"),
      }),
      execute: async ({ provider, name }) => {
        await gitRemote.deleteRepo(provider as GitRemoteProvider, name);
        return { deleted: true };
      },
    }),
  ];
}
