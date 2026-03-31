import type { SshService } from "../ssh/ssh.service";
import { infraConfig } from "../../config";

// ─── Types ───

export type GitRemoteProvider = "vps-bare" | "github" | "gitlab";

export interface GitRepo {
  name: string;
  provider: GitRemoteProvider;
  cloneUrl: string;    // URL pour git clone/push
  webUrl?: string;     // URL web (GitHub/GitLab) ou null (bare)
  serverId?: string;   // VPS server ID (bare repos only)
}

export interface CreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  serverId?: string;   // Required for vps-bare
  buildCommand?: string;
  startCommand?: string;
  appPort?: number;
}

// ─── Provider interface ───

export interface GitRemoteAdapter {
  readonly provider: GitRemoteProvider;
  createRepo(opts: CreateRepoOptions): Promise<GitRepo>;
  deleteRepo(name: string): Promise<void>;
  listRepos(): Promise<GitRepo[]>;
}

// ─── VPS Bare Git Adapter ───

export class VpsBareGitAdapter implements GitRemoteAdapter {
  readonly provider = "vps-bare" as const;

  constructor(private ssh: SshService) {}

  async createRepo(opts: CreateRepoOptions): Promise<GitRepo> {
    if (!opts.serverId) throw new Error("serverId required for vps-bare repos");

    const server = this.ssh.getServer(opts.serverId);
    if (!server) throw new Error(`Server "${opts.serverId}" not found`);

    const repoPath = `/opt/git/${opts.name}.git`;
    const appPath = `/opt/apps/${opts.name}`;

    // 1. Create bare repo
    await this.ssh.exec(opts.serverId, `mkdir -p ${repoPath} && cd ${repoPath} && git init --bare`);

    // 2. Create app directory
    await this.ssh.exec(opts.serverId, `mkdir -p ${appPath}`);

    // 3. Create post-receive hook
    const buildCmd = opts.buildCommand ?? "npm install && npm run build";
    const startCmd = opts.startCommand ?? `pm2 restart ${opts.name} 2>/dev/null || pm2 start npm --name ${opts.name} -- start`;

    const hook = `#!/bin/bash
set -e

APP_DIR="${appPath}"
REPO_DIR="${repoPath}"

echo "==> Deploying ${opts.name}..."

# Checkout latest code
git --work-tree="$APP_DIR" --git-dir="$REPO_DIR" checkout -f

cd "$APP_DIR"

# Build
echo "==> Building..."
${buildCmd}

# Restart
echo "==> Restarting..."
${startCmd}

echo "==> Deploy complete!"
`;

    await this.ssh.upload(opts.serverId, hook, `${repoPath}/hooks/post-receive`);
    await this.ssh.exec(opts.serverId, `chmod +x ${repoPath}/hooks/post-receive`);

    const cloneUrl = `${server.user}@${server.host}:${repoPath}`;

    return {
      name: opts.name,
      provider: "vps-bare",
      cloneUrl,
      serverId: opts.serverId,
    };
  }

  async deleteRepo(name: string): Promise<void> {
    // Find which server has this repo — check all servers
    for (const server of this.ssh.listServers()) {
      try {
        const result = await this.ssh.exec(server.id, `test -d /opt/git/${name}.git && echo "found"`);
        if (result.stdout.includes("found")) {
          await this.ssh.exec(server.id, `rm -rf /opt/git/${name}.git /opt/apps/${name}`);
          await this.ssh.exec(server.id, `pm2 delete ${name} 2>/dev/null; true`);
          return;
        }
      } catch { /* skip */ }
    }
    throw new Error(`Repo "${name}" not found on any server`);
  }

  async listRepos(): Promise<GitRepo[]> {
    const repos: GitRepo[] = [];
    for (const server of this.ssh.listServers()) {
      try {
        const result = await this.ssh.exec(server.id, "ls /opt/git/ 2>/dev/null || true");
        const dirs = result.stdout.split("\n").filter((d) => d.endsWith(".git"));
        for (const dir of dirs) {
          const name = dir.replace(".git", "");
          repos.push({
            name,
            provider: "vps-bare",
            cloneUrl: `${server.user}@${server.host}:/opt/git/${dir}`,
            serverId: server.id,
          });
        }
      } catch { /* skip */ }
    }
    return repos;
  }
}

// ─── GitHub Adapter ───

export class GitHubRemoteAdapter implements GitRemoteAdapter {
  readonly provider = "github" as const;

  async createRepo(opts: CreateRepoOptions): Promise<GitRepo> {
    const res = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${infraConfig.githubToken}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json",
      },
      body: JSON.stringify({
        name: opts.name,
        description: opts.description ?? "",
        private: opts.private ?? true,
        auto_init: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub API: ${res.status} ${err}`);
    }

    const data = await res.json() as { ssh_url: string; html_url: string };
    return {
      name: opts.name,
      provider: "github",
      cloneUrl: data.ssh_url,
      webUrl: data.html_url,
    };
  }

  async deleteRepo(name: string): Promise<void> {
    // Need owner — get from authenticated user
    const userRes = await fetch("https://api.github.com/user", {
      headers: { "Authorization": `Bearer ${infraConfig.githubToken}` },
    });
    const user = await userRes.json() as { login: string };

    const res = await fetch(`https://api.github.com/repos/${user.login}/${name}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${infraConfig.githubToken}` },
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`GitHub delete failed: ${res.status}`);
    }
  }

  async listRepos(): Promise<GitRepo[]> {
    const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: { "Authorization": `Bearer ${infraConfig.githubToken}` },
    });

    if (!res.ok) return [];
    const repos = await res.json() as { name: string; ssh_url: string; html_url: string }[];

    return repos.map((r) => ({
      name: r.name,
      provider: "github" as const,
      cloneUrl: r.ssh_url,
      webUrl: r.html_url,
    }));
  }
}

// ─── GitLab Adapter ───

export class GitLabRemoteAdapter implements GitRemoteAdapter {
  readonly provider = "gitlab" as const;

  private get baseUrl() { return infraConfig.gitlabUrl || "https://gitlab.com"; }

  async createRepo(opts: CreateRepoOptions): Promise<GitRepo> {
    const res = await fetch(`${this.baseUrl}/api/v4/projects`, {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": infraConfig.gitlabToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: opts.name,
        description: opts.description ?? "",
        visibility: opts.private !== false ? "private" : "public",
        initialize_with_readme: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitLab API: ${res.status} ${err}`);
    }

    const data = await res.json() as { ssh_url_to_repo: string; web_url: string };
    return {
      name: opts.name,
      provider: "gitlab",
      cloneUrl: data.ssh_url_to_repo,
      webUrl: data.web_url,
    };
  }

  async deleteRepo(name: string): Promise<void> {
    // Need project ID — search by name
    const searchRes = await fetch(`${this.baseUrl}/api/v4/projects?search=${name}&owned=true`, {
      headers: { "PRIVATE-TOKEN": infraConfig.gitlabToken },
    });
    const projects = await searchRes.json() as { id: number; name: string }[];
    const project = projects.find((p) => p.name === name);
    if (!project) return;

    await fetch(`${this.baseUrl}/api/v4/projects/${project.id}`, {
      method: "DELETE",
      headers: { "PRIVATE-TOKEN": infraConfig.gitlabToken },
    });
  }

  async listRepos(): Promise<GitRepo[]> {
    const res = await fetch(`${this.baseUrl}/api/v4/projects?owned=true&per_page=100&order_by=updated_at`, {
      headers: { "PRIVATE-TOKEN": infraConfig.gitlabToken },
    });

    if (!res.ok) return [];
    const projects = await res.json() as { name: string; ssh_url_to_repo: string; web_url: string }[];

    return projects.map((p) => ({
      name: p.name,
      provider: "gitlab" as const,
      cloneUrl: p.ssh_url_to_repo,
      webUrl: p.web_url,
    }));
  }
}

// ─── Git Remote Service (aggregates all providers) ───

export class GitRemoteService {
  private ssh: SshService;

  constructor(ssh: SshService) {
    this.ssh = ssh;
  }

  private getAdapters(): GitRemoteAdapter[] {
    const adapters: GitRemoteAdapter[] = [new VpsBareGitAdapter(this.ssh)];
    if (infraConfig.githubToken) adapters.push(new GitHubRemoteAdapter());
    if (infraConfig.gitlabToken) adapters.push(new GitLabRemoteAdapter());
    return adapters;
  }

  getAdapter(provider: GitRemoteProvider): GitRemoteAdapter {
    const adapter = this.getAdapters().find((a) => a.provider === provider);
    if (!adapter) throw new Error(`Git remote provider "${provider}" not available. Verifiez les Settings > Infrastructure.`);
    return adapter;
  }

  availableProviders(): GitRemoteProvider[] {
    return this.getAdapters().map((a) => a.provider);
  }

  async createRepo(provider: GitRemoteProvider, opts: CreateRepoOptions): Promise<GitRepo> {
    return this.getAdapter(provider).createRepo(opts);
  }

  async deleteRepo(provider: GitRemoteProvider, name: string): Promise<void> {
    return this.getAdapter(provider).deleteRepo(name);
  }

  async listRepos(): Promise<GitRepo[]> {
    const all: GitRepo[] = [];
    for (const adapter of this.getAdapters()) {
      try {
        const repos = await adapter.listRepos();
        all.push(...repos);
      } catch { /* skip failed providers */ }
    }
    return all;
  }
}
