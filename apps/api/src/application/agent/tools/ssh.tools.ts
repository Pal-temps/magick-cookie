import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { SshService } from "../../../infrastructure/ssh/ssh.service";

const AUTH_METHODS = ["key", "password"] as const;

export function createSshTools(ssh: SshService): AgentTool[] {
  return [
    defineTool({
      name: "server_list",
      description: "Liste tous les serveurs configures pour la connexion SSH.",
      params: z.object({}),
      execute: async () => {
        const servers = ssh.listServers();
        return { count: servers.length, servers };
      },
    }),
    defineTool({
      name: "server_add",
      description: "Ajoute un nouveau serveur pour les connexions SSH. Auth par cle ED25519 (recommande) ou mot de passe.",
      params: z.object({
        label: z.string().min(1).max(255).describe("Nom du serveur (ex: 'VPS OVH')"),
        host: z.string().min(1).max(255).describe("Adresse IP ou hostname"),
        user: z.string().min(1).max(64).describe("Utilisateur SSH (ex: 'root', 'deploy')"),
        port: z.number().int().min(1).max(65535).optional().describe("Port SSH (defaut: 22)"),
        auth_method: z.enum(AUTH_METHODS).optional().describe("Methode: 'key' (defaut) ou 'password'"),
        key_path: z.string().optional().describe("Chemin vers la cle SSH (defaut: ~/.ssh/id_ed25519)"),
      }),
      execute: async ({ label, host, user, port, auth_method, key_path }) => {
        const server = ssh.addServer({
          label,
          host,
          user,
          port: port ?? 22,
          authMethod: (auth_method ?? "key") as "key" | "password",
          keyPath: key_path,
        });
        return { added: true, server };
      },
    }),
    defineTool({
      name: "ssh_exec",
      description: "Execute une commande SSH sur un serveur. Retourne stdout, stderr et le code de sortie. ATTENTION: les commandes sont executees avec les privileges de l'utilisateur SSH configure. Action admin: exfiltration potentielle (ex: 'cat ~/.ssh/id_ed25519').",
      // Arbitrary shell on a remote with KDBX-sourced credentials. Treat as admin —
      // the dispatcher denies admin tools until an explicit elevated channel is wired.
      permissionLevel: "admin",
      params: z.object({
        server_id: z.string().min(1).describe("ID du serveur (utilise server_list pour le trouver)"),
        command: z.string().min(1).max(10_000).describe("Commande a executer"),
      }),
      execute: async ({ server_id, command }) => {
        const result = await ssh.exec(server_id, command);
        return {
          stdout: result.stdout.slice(0, 5000),
          stderr: result.stderr.slice(0, 2000),
          exit_code: result.code,
          truncated: result.stdout.length > 5000,
        };
      },
    }),
    defineTool({
      name: "ssh_upload",
      description: "Upload un fichier texte sur un serveur via SFTP. Utile pour ecrire des fichiers de config (Caddy, nginx, systemd, etc.). Action sensible: exige une confirmation utilisateur.",
      permissionLevel: "user-confirm",
      params: z.object({
        server_id: z.string().min(1).describe("ID du serveur"),
        content: z.string().max(1_000_000).describe("Contenu du fichier"),
        remote_path: z.string().min(1).max(4096).describe("Chemin distant (ex: /etc/caddy/Caddyfile)"),
      }),
      execute: async ({ server_id, content, remote_path }) => {
        await ssh.upload(server_id, content, remote_path);
        return { uploaded: true, path: remote_path };
      },
    }),
  ];
}
