import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
  readdirSync,
  unlinkSync,
  renameSync,
} from "fs";
import { join, dirname, relative, sep } from "path";
import type { VaultService } from "../vault/vault.service";
import type { VaultNoteRepository } from "../../domain/vault-note/vault-note.repository";
import {
  VaultNotFoundError,
  NoteNotFoundError,
  NoteAlreadyExistsError,
  InvalidNotePathError,
  NoteLockedError,
} from "../../domain/vault-note/vault-note.repository";
import type {
  VaultNote,
  VaultNoteRef,
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesOptions,
} from "../../domain/vault-note/vault-note.entity";

const LOCK_STALE_MS = 5_000;
const LOCK_SUFFIX = ".lock";
const MD_EXT = ".md";

// ─── Frontmatter helpers (same shape as skill.service) ───

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    if (!key) continue;
    let value: unknown = line.slice(colonIdx + 1).trim();
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    }
    meta[key] = value;
  }

  return { meta, body: match[2] };
}

function serializeFrontmatter(meta: Record<string, unknown>): string {
  const keys = Object.keys(meta).filter((k) => meta[k] !== null && meta[k] !== undefined);
  if (keys.length === 0) return "";
  const lines = keys.map((k) => {
    const v = meta[k];
    if (Array.isArray(v)) return `${k}: [${v.join(", ")}]`;
    return `${k}: ${String(v)}`;
  });
  return `---\n${lines.join("\n")}\n---\n`;
}

function mergeFrontmatter(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
}

// ─── Path normalization ───

function normalizeRelPath(path: string): string {
  // Always work with forward slashes and no leading slash for the domain-level path.
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function requireMdPath(path: string): void {
  const normalized = normalizeRelPath(path);
  if (!normalized) throw new InvalidNotePathError(path);
  if (!normalized.endsWith(MD_EXT)) throw new InvalidNotePathError(path);
  if (normalized.includes("\0")) throw new InvalidNotePathError(path);
}

// ─── Repo ───

export class FsVaultNoteRepository implements VaultNoteRepository {
  constructor(private vault: VaultService) {}

  private resolve(path: string): string {
    requireMdPath(path);
    const full = this.vault.resolvePath(normalizeRelPath(path));
    if (full === null) {
      // Either vault not configured or path traversal.
      if (!this.vault.getVaultPath()) throw new VaultNotFoundError();
      throw new InvalidNotePathError(path);
    }
    return full;
  }

  private lockPath(full: string): string {
    return `${full}${LOCK_SUFFIX}`;
  }

  private acquireLock(full: string): void {
    const lock = this.lockPath(full);
    if (existsSync(lock)) {
      try {
        const st = statSync(lock);
        if (Date.now() - st.mtimeMs < LOCK_STALE_MS) {
          throw new NoteLockedError(relative(this.vault.getVaultPath() ?? "", full));
        }
      } catch (err) {
        if (err instanceof NoteLockedError) throw err;
        // Stale lock — fall through and overwrite.
      }
    }
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(lock, String(Date.now()));
  }

  private releaseLock(full: string): void {
    const lock = this.lockPath(full);
    try { unlinkSync(lock); } catch { /* already gone */ }
  }

  private toDomain(relPath: string, full: string, raw: string): VaultNote {
    const st = statSync(full);
    const { meta, body } = parseFrontmatter(raw);
    return {
      path: normalizeRelPath(relPath),
      content: raw,
      frontmatter: meta,
      body,
      updatedAt: st.mtime,
      sizeBytes: st.size,
    };
  }

  async list(options: ListNotesOptions = {}): Promise<VaultNoteRef[]> {
    const vaultRoot = this.vault.getVaultPath();
    if (!vaultRoot) throw new VaultNotFoundError();

    const prefix = options.prefix ? normalizeRelPath(options.prefix) : "";
    const startFull = prefix ? this.vault.resolvePath(prefix) : vaultRoot;
    if (startFull === null) throw new InvalidNotePathError(prefix);
    if (!existsSync(startFull)) return [];

    const results: VaultNoteRef[] = [];
    const walk = (dir: string) => {
      let entries: ReturnType<typeof readdirSync>;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name.endsWith(LOCK_SUFFIX)) continue;
        const sub = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(sub);
          continue;
        }
        if (!entry.name.endsWith(MD_EXT)) continue;
        const rel = relative(vaultRoot, sub).split(sep).join("/");
        const st = statSync(sub);
        results.push({ path: rel, updatedAt: st.mtime, sizeBytes: st.size });
      }
    };
    walk(startFull);

    // Stable ordering: most recently updated first.
    results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return options.limit ? results.slice(0, options.limit) : results;
  }

  async read(path: string): Promise<VaultNote> {
    const full = this.resolve(path);
    if (!existsSync(full)) throw new NoteNotFoundError(normalizeRelPath(path));
    const raw = readFileSync(full, "utf-8");
    return this.toDomain(path, full, raw);
  }

  async create(input: CreateNoteInput): Promise<VaultNote> {
    const full = this.resolve(input.path);
    if (existsSync(full)) throw new NoteAlreadyExistsError(normalizeRelPath(input.path));

    this.acquireLock(full);
    try {
      const content = (input.frontmatter && Object.keys(input.frontmatter).length > 0)
        ? serializeFrontmatter(input.frontmatter) + input.body
        : input.body;
      writeFileSync(full, content);
      const raw = readFileSync(full, "utf-8");
      return this.toDomain(input.path, full, raw);
    } finally {
      this.releaseLock(full);
    }
  }

  async update(path: string, input: UpdateNoteInput): Promise<VaultNote> {
    const full = this.resolve(path);
    if (!existsSync(full)) throw new NoteNotFoundError(normalizeRelPath(path));

    this.acquireLock(full);
    try {
      const raw = readFileSync(full, "utf-8");
      const { meta, body: existingBody } = parseFrontmatter(raw);

      const nextMeta = input.frontmatter ? mergeFrontmatter(meta, input.frontmatter) : meta;
      const nextBody = input.body !== undefined ? input.body : existingBody;

      const content = Object.keys(nextMeta).length > 0
        ? serializeFrontmatter(nextMeta) + nextBody
        : nextBody;

      writeFileSync(full, content);
      const after = readFileSync(full, "utf-8");
      return this.toDomain(path, full, after);
    } finally {
      this.releaseLock(full);
    }
  }

  async append(path: string, text: string): Promise<VaultNote> {
    const full = this.resolve(path);
    if (!existsSync(full)) throw new NoteNotFoundError(normalizeRelPath(path));

    this.acquireLock(full);
    try {
      const raw = readFileSync(full, "utf-8");
      const { meta, body } = parseFrontmatter(raw);
      const separator = body.length === 0 || body.endsWith("\n") ? "" : "\n";
      const nextBody = `${body}${separator}${text}`;
      const content = Object.keys(meta).length > 0
        ? serializeFrontmatter(meta) + nextBody
        : nextBody;
      writeFileSync(full, content);
      const after = readFileSync(full, "utf-8");
      return this.toDomain(path, full, after);
    } finally {
      this.releaseLock(full);
    }
  }

  async delete(path: string): Promise<void> {
    const full = this.resolve(path);
    if (!existsSync(full)) throw new NoteNotFoundError(normalizeRelPath(path));

    this.acquireLock(full);
    try {
      unlinkSync(full);
    } finally {
      this.releaseLock(full);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<VaultNote> {
    const oldFull = this.resolve(oldPath);
    if (!existsSync(oldFull)) throw new NoteNotFoundError(normalizeRelPath(oldPath));
    const newFull = this.resolve(newPath);
    if (existsSync(newFull)) throw new NoteAlreadyExistsError(normalizeRelPath(newPath));

    this.acquireLock(oldFull);
    try {
      mkdirSync(dirname(newFull), { recursive: true });
      renameSync(oldFull, newFull);
      const raw = readFileSync(newFull, "utf-8");
      return this.toDomain(newPath, newFull, raw);
    } finally {
      // Old lock path is gone (renamed the target); clear the new one.
      this.releaseLock(oldFull);
      this.releaseLock(newFull);
    }
  }
}
