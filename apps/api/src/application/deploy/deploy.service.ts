import type { DnsService } from "../../infrastructure/dns/dns.service";
import type { SshService } from "../../infrastructure/ssh/ssh.service";
import type { GitRemoteService } from "../../infrastructure/git-remote/git-remote.service";
import {
  assertSafeIdentifier,
  assertSafeDnsLabel,
  assertSafeDnsZone,
  assertSafeShellFragment,
} from "../../infrastructure/security/safe-names";

// ─── Types ───

export interface DeployConfig {
  appName: string;
  subdomain: string;
  zone: string;
  serverIp: string;
  serverId: string;
  repoUrl?: string;           // Direct clone URL (legacy)
  gitProvider?: string;       // "vps-bare" | "github" | "gitlab" — use git remote system
  buildCommand: string;
  startCommand: string;
  appPort: number;
  appPath?: string;
}

export interface DeployStep {
  step: "dns" | "repo" | "clone" | "build" | "caddy" | "start" | "verify";
  status: "running" | "done" | "error";
  message?: string;
}

// ─── Caddy config generator ───

function generateCaddyblock(domain: string, port: number): string {
  return `${domain} {\n  reverse_proxy localhost:${port}\n}\n`;
}

// ─── Deploy Service ───

export class DeployService {
  constructor(
    private dns: DnsService,
    private ssh: SshService,
    private gitRemote?: GitRemoteService,
  ) {}

  async *deploy(config: DeployConfig): AsyncGenerator<DeployStep> {
    // Guard every value that will be interpolated into a shell command or path. The HTTP entry
    // point also validates via Zod, but this is the last line of defence for any direct caller.
    assertSafeIdentifier(config.appName, "appName");
    assertSafeIdentifier(config.serverId, "serverId");
    assertSafeDnsLabel(config.subdomain, "subdomain");
    assertSafeDnsZone(config.zone, "zone");
    assertSafeShellFragment(config.buildCommand, "buildCommand");
    assertSafeShellFragment(config.startCommand, "startCommand");
    if (!Number.isInteger(config.appPort) || config.appPort < 1 || config.appPort > 65535) {
      throw new Error("Invalid appPort");
    }
    if (config.repoUrl !== undefined && !/^(https:\/\/|git:\/\/|git@|ssh:\/\/)[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$/.test(config.repoUrl)) {
      throw new Error("Invalid repoUrl: only https://, git://, ssh://, or git@ schemes are allowed");
    }
    if (config.appPath !== undefined && !/^\/opt\/apps\/[a-zA-Z0-9_-]{1,63}$/.test(config.appPath)) {
      throw new Error("Invalid appPath: must match /opt/apps/<alphanum-name>");
    }

    const appPath = config.appPath ?? `/opt/apps/${config.appName}`;
    const domain = `${config.subdomain}.${config.zone}`;

    // 1. DNS
    yield { step: "dns", status: "running", message: `Creation ${domain} → ${config.serverIp}` };
    try {
      await this.dns.createRecord(config.zone, {
        type: "A",
        name: config.subdomain,
        content: config.serverIp,
        ttl: 300,
      });
      yield { step: "dns", status: "done", message: `${domain} cree` };
    } catch (e: any) {
      yield { step: "dns", status: "error", message: e.message };
      return;
    }

    // 2. Create git repo (if using git remote system)
    if (config.gitProvider && this.gitRemote) {
      yield { step: "repo", status: "running", message: `Creation repo ${config.appName} (${config.gitProvider})` };
      try {
        const repo = await this.gitRemote.createRepo(config.gitProvider as any, {
          name: config.appName,
          serverId: config.serverId,
          buildCommand: config.buildCommand,
          startCommand: config.startCommand,
          appPort: config.appPort,
        });
        yield {
          step: "repo",
          status: "done",
          message: `Repo cree: ${repo.cloneUrl}\nPush avec: git remote add deploy ${repo.cloneUrl} && git push deploy main`,
        };
        // For vps-bare, the deploy happens on push — we're done with the code part
        if (config.gitProvider === "vps-bare") {
          // Still configure Caddy
          yield* this.configureCaddy(config.serverId, config.appName, domain, config.appPort);
          yield { step: "verify", status: "done", message: `https://${domain} — pret. Faites 'git push deploy main' pour deployer.` };
          return;
        }
      } catch (e: any) {
        yield { step: "repo", status: "error", message: e.message };
        return;
      }
    }

    // 3. Clone (direct URL mode)
    if (config.repoUrl) {
      yield { step: "clone", status: "running", message: `Cloning ${config.repoUrl}` };
      try {
        await this.ssh.exec(config.serverId, `mkdir -p ${appPath} && rm -rf ${appPath}/*`);
        const cloneResult = await this.ssh.exec(config.serverId, `git clone ${config.repoUrl} ${appPath}`);
        if (cloneResult.code !== 0) throw new Error(cloneResult.stderr);
        yield { step: "clone", status: "done" };
      } catch (e: any) {
        yield { step: "clone", status: "error", message: e.message };
        return;
      }

      // 4. Build
      yield { step: "build", status: "running", message: config.buildCommand };
      try {
        const buildResult = await this.ssh.exec(config.serverId, `cd ${appPath} && ${config.buildCommand}`);
        if (buildResult.code !== 0) throw new Error(buildResult.stderr);
        yield { step: "build", status: "done" };
      } catch (e: any) {
        yield { step: "build", status: "error", message: e.message };
        return;
      }

      // 5. Start app
      yield { step: "start", status: "running", message: config.startCommand };
      try {
        await this.ssh.exec(config.serverId, `pm2 delete ${config.appName} 2>/dev/null; true`);
        const startResult = await this.ssh.exec(config.serverId, `cd ${appPath} && ${config.startCommand}`);
        if (startResult.code !== 0) throw new Error(startResult.stderr);
        yield { step: "start", status: "done" };
      } catch (e: any) {
        yield { step: "start", status: "error", message: e.message };
        return;
      }
    }

    // 6. Caddy
    yield* this.configureCaddy(config.serverId, config.appName, domain, config.appPort);

    // 7. Verify
    yield { step: "verify", status: "running", message: `Checking https://${domain}` };
    try {
      await new Promise((r) => setTimeout(r, 3000));
      const check = await this.ssh.exec(config.serverId, `curl -s -o /dev/null -w '%{http_code}' http://localhost:${config.appPort}/`);
      const status = check.stdout.trim();
      if (status.startsWith("2") || status.startsWith("3")) {
        yield { step: "verify", status: "done", message: `https://${domain} — HTTP ${status}` };
      } else {
        yield { step: "verify", status: "error", message: `HTTP ${status}` };
      }
    } catch (e: any) {
      yield { step: "verify", status: "error", message: e.message };
    }
  }

  private async *configureCaddy(serverId: string, appName: string, domain: string, port: number): AsyncGenerator<DeployStep> {
    yield { step: "caddy", status: "running", message: `Configuring ${domain} → :${port}` };
    try {
      const caddyConf = generateCaddyblock(domain, port);
      await this.ssh.exec(serverId, "mkdir -p /etc/caddy/sites");
      await this.ssh.upload(serverId, caddyConf, `/etc/caddy/sites/${appName}.caddy`);
      await this.ssh.exec(serverId, `grep -q 'import sites/' /etc/caddy/Caddyfile || echo 'import sites/*' >> /etc/caddy/Caddyfile`);
      await this.ssh.exec(serverId, "systemctl reload caddy");
      yield { step: "caddy", status: "done" };
    } catch (e: any) {
      yield { step: "caddy", status: "error", message: e.message };
    }
  }
}
