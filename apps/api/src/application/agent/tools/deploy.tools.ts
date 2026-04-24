import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
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
    defineTool({
      name: "caddy_add_site",
      description: "Ajoute un site dans la config Caddy (reverse proxy + auto-HTTPS). Ne cree PAS de record DNS — utilise dns_create_record d'abord.",
      params: z.object({
        server_id: z.string().min(1).describe("ID du serveur"),
        domain: z.string().min(1).max(253).describe("Domaine complet (ex: app.paltemps.fr)"),
        port: z.number().int().min(1).max(65535).describe("Port local de l'app"),
      }),
      execute: async ({ server_id, domain, port }) => {
        assertSafeIdentifier(server_id, "server_id");
        const parts = domain.split(".");
        if (parts.length < 2) throw new Error("Invalid domain");
        const appName = parts[0];
        assertSafeDnsLabel(appName, "domain label");
        assertSafeDnsZone(parts.slice(1).join("."), "domain zone");

        const caddyConf = `${domain} {\n  reverse_proxy localhost:${port}\n}\n`;
        await ssh.upload(server_id, caddyConf, `/etc/caddy/sites/${appName}.caddy`);
        await ssh.exec(server_id, `grep -q 'import sites/' /etc/caddy/Caddyfile || echo 'import sites/*' >> /etc/caddy/Caddyfile`);
        await ssh.exec(server_id, "systemctl reload caddy");

        return { configured: true, domain, port };
      },
    }),
    defineTool({
      name: "caddy_list_sites",
      description: "Liste les sites configures dans Caddy sur un serveur.",
      params: z.object({
        server_id: z.string().min(1).describe("ID du serveur"),
      }),
      execute: async ({ server_id }) => {
        assertSafeIdentifier(server_id, "server_id");
        const result = await ssh.exec(server_id, "ls /etc/caddy/sites/ 2>/dev/null || echo '(no sites dir)'");
        const files = result.stdout.split("\n").filter(Boolean);
        return { count: files.length, sites: files };
      },
    }),
  ];
}
