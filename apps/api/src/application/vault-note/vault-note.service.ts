import type { VaultNoteRepository } from "../../domain/vault-note/vault-note.repository";
import type {
  VaultNote,
  VaultNoteRef,
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesOptions,
} from "../../domain/vault-note/vault-note.entity";

export const AI_DEFAULT_PREFIX = "_ai/";

/**
 * When a caller (typically the AI tool layer) doesn't supply an explicit sub-folder,
 * we default to `_ai/` so AI-generated notes are kept separate from the user's vault.
 */
export function applyAiDefaultPrefix(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("/")) return normalized;
  return `${AI_DEFAULT_PREFIX}${normalized}`;
}

export class VaultNoteService {
  constructor(private repo: VaultNoteRepository) {}

  list(options?: ListNotesOptions): Promise<VaultNoteRef[]> {
    return this.repo.list(options);
  }

  read(path: string): Promise<VaultNote> {
    return this.repo.read(path);
  }

  create(input: CreateNoteInput): Promise<VaultNote> {
    return this.repo.create(input);
  }

  /**
   * Create with the _ai/ default prefix when the path is a bare filename.
   * Used by AI tools so "note.md" lands in "_ai/note.md".
   */
  createForAi(input: CreateNoteInput): Promise<VaultNote> {
    return this.repo.create({ ...input, path: applyAiDefaultPrefix(input.path) });
  }

  update(path: string, input: UpdateNoteInput): Promise<VaultNote> {
    return this.repo.update(path, input);
  }

  append(path: string, text: string): Promise<VaultNote> {
    return this.repo.append(path, text);
  }

  delete(path: string): Promise<void> {
    return this.repo.delete(path);
  }

  rename(oldPath: string, newPath: string): Promise<VaultNote> {
    return this.repo.rename(oldPath, newPath);
  }
}
