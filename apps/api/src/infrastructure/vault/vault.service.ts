import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, realpathSync } from "fs";
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
    if (typeof relPath !== "string") return null;
    if (relPath.includes("\0")) return null;
    if (relPath.includes("..")) return null;

    const vaultRoot = resolve(this._vaultPath);
    const full = resolve(join(vaultRoot, relPath));

    // Lexical boundary check (covers non-existent write targets).
    if (full !== vaultRoot && !full.startsWith(vaultRoot + sep)) return null;

    // Symlink boundary check: walk upward until an existing ancestor is found, resolve it via
    // realpath, then ensure the realpath is still inside the vault root. This defeats attackers
    // who planted a symlink inside the vault pointing at /etc or similar.
    let probe = full;
    while (!existsSync(probe)) {
      const parent = resolve(probe, "..");
      if (parent === probe) return null; // reached filesystem root without finding the vault
      probe = parent;
    }
    const realProbe = realpathSync(probe);
    const realVault = realpathSync(vaultRoot);
    if (realProbe !== realVault && !realProbe.startsWith(realVault + sep)) return null;

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
