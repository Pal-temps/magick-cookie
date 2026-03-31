import type { AgentTool } from "../tool-registry";
import type { SshService } from "../../../infrastructure/ssh/ssh.service";

export function createSshTools(ssh: SshService): AgentTool[] {
  return [
    {
      name: "server_list",
      description: "Liste tous les serveurs configures pour la connexion SSH.",
      parameters: {},
      execute: async () => {
        const servers = ssh.listServers();
        return { count: servers.length, servers };
      },
    },
    {
      name: "server_add",
      description: "Ajoute un nouveau serveur pour les connexions SSH. Auth par cle ED25519 (recommande) ou mot de passe.",
      parameters: {
        label: { type: "string", description: "Nom du serveur (ex: 'VPS OVH')", required: true },
        host: { type: "string", description: "Adresse IP ou hostname", required: true },
        user: { type: "string", description: "Utilisateur SSH (ex: 'root', 'deploy')", required: true },
        port: { type: "number", description: "Port SSH (defaut: 22)", required: false },
        auth_method: { type: "string", description: "Methode: 'key' (defaut) ou 'password'", required: false },
        key_path: { type: "string", description: "Chemin vers la cle SSH (defaut: ~/.ssh/id_ed25519)", required: false },
      },
      execute: async (params) => {
        const server = ssh.addServer({
          label: params.label as string,
          host: params.host as string,
          user: params.user as string,
          port: (params.port as number) || 22,
          authMethod: (params.auth_method as "key" | "password") || "key",
          keyPath: params.key_path as string | undefined,
        });
        return { added: true, server };
      },
    },
    {
      name: "ssh_exec",
      description: "Execute une commande SSH sur un serveur. Retourne stdout, stderr et le code de sortie. ATTENTION: les commandes sont executees avec les privileges de l'utilisateur SSH configure.",
      parameters: {
        server_id: { type: "string", description: "ID du serveur (utilise server_list pour le trouver)", required: true },
        command: { type: "string", description: "Commande a executer", required: true },
      },
      execute: async (params) => {
        const result = await ssh.exec(params.server_id as string, params.command as string);
        return {
          stdout: result.stdout.slice(0, 5000), // Limit output size
          stderr: result.stderr.slice(0, 2000),
          exit_code: result.code,
          truncated: result.stdout.length > 5000,
        };
      },
    },
    {
      name: "ssh_upload",
      description: "Upload un fichier texte sur un serveur via SFTP. Utile pour ecrire des fichiers de config (Caddy, nginx, systemd, etc.).",
      parameters: {
        server_id: { type: "string", description: "ID du serveur", required: true },
        content: { type: "string", description: "Contenu du fichier", required: true },
        remote_path: { type: "string", description: "Chemin distant (ex: /etc/caddy/Caddyfile)", required: true },
      },
      execute: async (params) => {
        await ssh.upload(
          params.server_id as string,
          params.content as string,
          params.remote_path as string,
        );
        return { uploaded: true, path: params.remote_path };
      },
    },
  ];
}
