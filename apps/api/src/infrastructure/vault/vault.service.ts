import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join, resolve, sep } from "path";

export class VaultService {
  private _vaultPath: string | null = null;

  setVaultPath(path: string) {
    this._vaultPath = path;
  }

  getVaultPath(): string | null {
    return this._vaultPath;
  }

  /** Resolve a relative path within the vault, with safety checks */
  resolvePath(relPath: string): string | null {
    if (!this._vaultPath) return null;
    if (relPath.includes("..")) return null;
    const full = join(this._vaultPath, relPath);
    // Ensure resolved path is within vault
    if (!resolve(full).startsWith(resolve(this._vaultPath) + sep) &&
        resolve(full) !== resolve(this._vaultPath)) {
      return null;
    }
    return full;
  }

  readJson<T>(relPath: string): T | null {
    const full = this.resolvePath(relPath);
    if (!full || !existsSync(full)) return null;
    try {
      return JSON.parse(readFileSync(full, "utf-8")) as T;
    } catch {
      return null;
    }
  }

  writeJson(relPath: string, data: unknown): void {
    const full = this.resolvePath(relPath);
    if (!full) throw new Error(`Invalid vault path: ${relPath}`);
    const dir = join(full, "..");
    mkdirSync(dir, { recursive: true });
    writeFileSync(full, JSON.stringify(data, null, 2));
  }

  readText(relPath: string): string | null {
    const full = this.resolvePath(relPath);
    if (!full || !existsSync(full)) return null;
    try {
      return readFileSync(full, "utf-8");
    } catch {
      return null;
    }
  }

  writeText(relPath: string, content: string): void {
    const full = this.resolvePath(relPath);
    if (!full) throw new Error(`Invalid vault path: ${relPath}`);
    const dir = join(full, "..");
    mkdirSync(dir, { recursive: true });
    writeFileSync(full, content);
  }

  listDir(relPath: string, ext?: string): string[] {
    const full = this.resolvePath(relPath);
    if (!full || !existsSync(full)) return [];
    try {
      const entries = readdirSync(full, { withFileTypes: true });
      return entries
        .filter((e) => !e.name.startsWith("."))
        .filter((e) => !ext || e.name.endsWith(ext) || e.isDirectory())
        .map((e) => e.name);
    } catch {
      return [];
    }
  }
}
