import type { AgentTool } from "../tool-registry";
import type { DeployService } from "../../deploy/deploy.service";
import type { SshService } from "../../../infrastructure/ssh/ssh.service";

export function createDeployTools(deploy: DeployService, ssh: SshService): AgentTool[] {
  return [
    {
      name: "deploy_app",
      description: "Deploy complet d'une application : cree le sous-domaine DNS, clone le repo sur le serveur, build, configure Caddy (auto-HTTPS), demarre l'app. Retourne le resultat de chaque etape.",
      parameters: {
        app_name: { type: "string", description: "Nom unique de l'app (ex: 'mon-app')", required: true },
        subdomain: { type: "string", description: "Sous-domaine (ex: 'app' pour app.paltemps.fr)", required: true },
        zone: { type: "string", description: "Zone DNS (ex: 'paltemps.fr')", required: true },
        server_id: { type: "string", description: "ID du serveur cible", required: true },
        server_ip: { type: "string", description: "IP publique du serveur (pour le record DNS A)", required: true },
        repo_url: { type: "string", description: "URL du repo git a cloner", required: true },
        build_command: { type: "string", description: "Commande de build (ex: 'npm install && npm run build')", required: true },
        start_command: { type: "string", description: "Commande de demarrage (ex: 'pm2 start npm --name app -- start')", required: true },
        port: { type: "number", description: "Port de l'app (ex: 3000)", required: true },
      },
      execute: async (params) => {
        const steps: { step: string; status: string; message?: string }[] = [];

        for await (const event of deploy.deploy({
          appName: params.app_name as string,
          subdomain: params.subdomain as string,
          zone: params.zone as string,
          serverId: params.server_id as string,
          serverIp: params.server_ip as string,
          repoUrl: params.repo_url as string,
          buildCommand: params.build_command as string,
          startCommand: params.start_command as string,
          appPort: params.port as number,
        })) {
          steps.push(event);
        }

        const lastStep = steps[steps.length - 1];
        const success = lastStep?.status !== "error";
        const domain = `${params.subdomain}.${params.zone}`;

        return {
          success,
          url: success ? `https://${domain}` : null,
          steps,
        };
      },
    },
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
        const appName = domain.split(".")[0];

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
        const result = await ssh.exec(params.server_id as string, "ls /etc/caddy/sites/ 2>/dev/null || echo '(no sites dir)'");
        const files = result.stdout.split("\n").filter(Boolean);
        return { count: files.length, sites: files };
      },
    },
  ];
}
