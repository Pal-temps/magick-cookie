import type { AgentTool } from "../tool-registry";
import type { SshService } from "../../../infrastructure/ssh/ssh.service";
import {
  assertSafeIdentifier,
  assertSafeDnsLabel,
  assertSafeDnsZone,
} from "../../../infrastructure/security/safe-names";

// NOTE: the full `deploy_app` tool used to live here. It let the LLM supply arbitrary
// `build_command` / `start_command` strings that were piped through `ssh.exec`, which is a
// command-injection footgun the moment the model is nudged by a prompt-injection payload. Deploys
// now have to go through the UI (`/api/infra/deploy`) where a human reviews the config.
export function createDeployTools(ssh: SshService): AgentTool[] {
  return [
    {
      name: "caddy_add_site",
      description: "Ajoute un site dans la config Caddy (reverse proxy + auto-HTTPS). Ne cree PAS de record DNS — utilise dns_create_record d'abord.",
      parameters: {
        server_id: { type: "string", description: "ID du serveur", required: true },
        domain: { type: "string", description: "Domaine complet (ex: app.paltemps.fr)", required: true },
        port: { type: "number", description: "Port local de l'app", required: true },
      },
      execute: async (params) => {
        const domain = params.domain as string;
        const port = params.port as number;
        const serverId = params.server_id as string;

        assertSafeIdentifier(serverId, "server_id");
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error("Invalid port");
        }
        const parts = domain.split(".");
        if (parts.length < 2) throw new Error("Invalid domain");
        const appName = parts[0];
        assertSafeDnsLabel(appName, "domain label");
        assertSafeDnsZone(parts.slice(1).join("."), "domain zone");

        const caddyConf = `${domain} {\n  reverse_proxy localhost:${port}\n}\n`;
        await ssh.upload(serverId, caddyConf, `/etc/caddy/sites/${appName}.caddy`);
        await ssh.exec(serverId, `grep -q 'import sites/' /etc/caddy/Caddyfile || echo 'import sites/*' >> /etc/caddy/Caddyfile`);
        await ssh.exec(serverId, "systemctl reload caddy");

        return { configured: true, domain, port };
      },
    },
    {
      name: "caddy_list_sites",
      description: "Liste les sites configures dans Caddy sur un serveur.",
      parameters: {
        server_id: { type: "string", description: "ID du serveur", required: true },
      },
      execute: async (params) => {
        const serverId = params.server_id as string;
        assertSafeIdentifier(serverId, "server_id");
        const result = await ssh.exec(serverId, "ls /etc/caddy/sites/ 2>/dev/null || echo '(no sites dir)'");
        const files = result.stdout.split("\n").filter(Boolean);
        return { count: files.length, sites: files };
      },
    },
  ];
}
