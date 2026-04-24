import type {
  VaultNote,
  VaultNoteRef,
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesOptions,
} from "./vault-note.entity";

export class VaultNotFoundError extends Error {
  constructor() { super("Vault not configured"); this.name = "VaultNotFoundError"; }
}

export class NoteNotFoundError extends Error {
  constructor(path: string) { super(`Note not found: ${path}`); this.name = "NoteNotFoundError"; }
}

export class NoteAlreadyExistsError extends Error {
  constructor(path: string) { super(`Note already exists: ${path}`); this.name = "NoteAlreadyExistsError"; }
}

export class InvalidNotePathError extends Error {
  constructor(path: string) { super(`Invalid note path: ${path}`); this.name = "InvalidNotePathError"; }
}

export class NoteLockedError extends Error {
  constructor(path: string) { super(`Note is locked: ${path}`); this.name = "NoteLockedError"; }
}

export interface VaultNoteRepository {
  list(options?: ListNotesOptions): Promise<VaultNoteRef[]>;
  read(path: string): Promise<VaultNote>;
  create(input: CreateNoteInput): Promise<VaultNote>;
  update(path: string, input: UpdateNoteInput): Promise<VaultNote>;
  append(path: string, text: string): Promise<VaultNote>;
  delete(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<VaultNote>;
}
