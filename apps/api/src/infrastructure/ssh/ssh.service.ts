import { Client } from "ssh2";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { VaultService } from "../vault/vault.service";

// ─── Types ───

export interface ServerConfig {
  id: string;
  label: string;
  host: string;
  port: number;
  user: string;
  authMethod: "key" | "password";
  keyPath?: string;
  password?: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

// ─── SSH Service ───

export class SshService {
  private servers: Map<string, ServerConfig> = new Map();
  private vault: VaultService | null = null;
  private legacyConfigPath: string;

  constructor(vault?: VaultService) {
    this.vault = vault ?? null;
    this.legacyConfigPath = join(homedir(), ".config", "magick-cookie", "servers.json");
    this.loadServers();
  }

  private loadServers() {
    // Try vault first
    if (this.vault) {
      const data = this.vault.readJson<ServerConfig[]>("_config/servers.json");
      if (data) {
        for (const s of data) this.servers.set(s.id, s);
        return;
      }
    }
    // Fallback to legacy path
    if (existsSync(this.legacyConfigPath)) {
      try {
        const data = JSON.parse(readFileSync(this.legacyConfigPath, "utf-8")) as ServerConfig[];
        for (const s of data) this.servers.set(s.id, s);
      } catch { /* ignore corrupt file */ }
    }
  }

  private saveServers() {
    const serverList = Array.from(this.servers.values());
    // Write to vault if available
    if (this.vault) {
      // Sanitized version (no passwords/keyPaths)
      const sanitized = serverList.map(({ password, keyPath, ...rest }) => rest);
      this.vault.writeJson("_config/servers.json", sanitized);
    }
    // Also write full version to legacy path (for local use)
    const dir = join(homedir(), ".config", "magick-cookie");
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.legacyConfigPath, JSON.stringify(serverList, null, 2));
  }

  // ─── Server CRUD ───

  listServers(): ServerConfig[] {
    return Array.from(this.servers.values()).map((s) => ({
      ...s,
      password: undefined, // Don't expose passwords
      keyPath: s.keyPath ? "***" : undefined,
    }));
  }

  addServer(config: Omit<ServerConfig, "id">): ServerConfig {
    const id = `srv-${Date.now().toString(36)}`;
    const server: ServerConfig = { id, ...config };
    this.servers.set(id, server);
    this.saveServers();
    return { ...server, password: undefined };
  }

  removeServer(id: string): boolean {
    const deleted = this.servers.delete(id);
    if (deleted) this.saveServers();
    return deleted;
  }

  getServer(id: string): ServerConfig | undefined {
    return this.servers.get(id);
  }

  // ─── SSH Connection ───

  private createConnection(server: ServerConfig): Promise<Client> {
    return new Promise((resolve, reject) => {
      const conn = new Client();

      const connectConfig: any = {
        host: server.host,
        port: server.port,
        username: server.user,
      };

      if (server.authMethod === "key") {
        const keyPath = server.keyPath ?? join(homedir(), ".ssh", "id_ed25519");
        if (!existsSync(keyPath)) {
          reject(new Error(`SSH key not found: ${keyPath}`));
          return;
        }
        connectConfig.privateKey = readFileSync(keyPath);
      } else if (server.password) {
        connectConfig.password = server.password;
      }

      conn.on("ready", () => resolve(conn));
      conn.on("error", (err: Error) => reject(err));
      conn.connect(connectConfig);
    });
  }

  // ─── Execute command ───

  async exec(serverId: string, command: string): Promise<ExecResult> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server "${serverId}" not found`);

    const conn = await this.createConnection(server);

    return new Promise((resolve, reject) => {
      conn.exec(command, (err: Error | undefined, stream: any) => {
        if (err) { conn.end(); reject(err); return; }

        let stdout = "";
        let stderr = "";

        stream.on("data", (data: Buffer) => { stdout += data.toString(); });
        stream.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
        stream.on("close", (code: number) => {
          conn.end();
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 0 });
        });
      });
    });
  }

  // ─── Upload file content ───

  async upload(serverId: string, content: string, remotePath: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server "${serverId}" not found`);

    const conn = await this.createConnection(server);

    return new Promise((resolve, reject) => {
      conn.sftp((err: Error | undefined, sftp: any) => {
        if (err) { conn.end(); reject(err); return; }

        const stream = sftp.createWriteStream(remotePath);
        stream.on("close", () => { conn.end(); resolve(); });
        stream.on("error", (e: Error) => { conn.end(); reject(e); });
        stream.write(content);
        stream.end();
      });
    });
  }
}
