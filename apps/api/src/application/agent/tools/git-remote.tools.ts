import type { AgentTool } from "../tool-registry";
import type { GitRemoteService, GitRemoteProvider } from "../../../infrastructure/git-remote/git-remote.service";

export function createGitRemoteTools(gitRemote: GitRemoteService): AgentTool[] {
  return [
    {
      name: "git_remote_providers",
      description: "Liste les providers git disponibles (vps-bare, github, gitlab). vps-bare cree un repo directement sur le serveur avec un hook post-receive pour auto-deploy.",
      parameters: {},
      execute: async () => {
        return { providers: gitRemote.availableProviders() };
      },
    },
    {
      name: "git_remote_list",
      description: "Liste tous les repos git sur tous les providers configures.",
      parameters: {},
      execute: async () => {
        const repos = await gitRemote.listRepos();
        return { count: repos.length, repos };
      },
    },
    {
      name: "git_remote_create",
      description: "Cree un nouveau repo git. Pour 'vps-bare', cree un bare repo sur le serveur avec un hook post-receive qui auto-deploy a chaque push. Pour 'github'/'gitlab', cree un repo sur la plateforme.",
      parameters: {
        provider: { type: "string", description: "Provider: 'vps-bare' (recommande, auto-deploy), 'github', ou 'gitlab'", required: true },
        name: { type: "string", description: "Nom du repo (ex: 'mon-app')", required: true },
        server_id: { type: "string", description: "ID du serveur (requis pour vps-bare)", required: false },
        build_command: { type: "string", description: "Commande de build pour le hook post-receive (defaut: npm install && npm run build)", required: false },
        start_command: { type: "string", description: "Commande de demarrage (defaut: pm2 restart {name})", required: false },
        description: { type: "string", description: "Description du repo (github/gitlab)", required: false },
        private: { type: "boolean", description: "Repo prive (defaut: true)", required: false },
      },
      execute: async (params) => {
        const repo = await gitRemote.createRepo(params.provider as GitRemoteProvider, {
          name: params.name as string,
          serverId: params.server_id as string | undefined,
          buildCommand: params.build_command as string | undefined,
          startCommand: params.start_command as string | undefined,
          description: params.description as string | undefined,
          private: params.private as boolean | undefined,
        });

        return {
          created: true,
          repo,
          instructions: repo.provider === "vps-bare"
            ? `Repo cree. Pour deployer:\n  git remote add vps ${repo.cloneUrl}\n  git push vps main\nLe hook post-receive va automatiquement builder et redemarrer l'app.`
            : `Repo cree sur ${repo.provider}. URL: ${repo.webUrl ?? repo.cloneUrl}`,
        };
      },
    },
    {
      name: "git_remote_delete",
      description: "Supprime un repo git et ses fichiers associes (app + hook pour vps-bare).",
      parameters: {
        provider: { type: "string", description: "Provider du repo", required: true },
        name: { type: "string", description: "Nom du repo", required: true },
      },
      execute: async (params) => {
        await gitRemote.deleteRepo(params.provider as GitRemoteProvider, params.name as string);
        return { deleted: true };
      },
    },
  ];
}
