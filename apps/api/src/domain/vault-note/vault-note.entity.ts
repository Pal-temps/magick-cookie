export interface VaultNote {
  /** Relative path from the vault root, forward slashes, without leading slash. */
  path: string;
  /** Full raw file content (frontmatter block + body). */
  content: string;
  /** Parsed YAML frontmatter block (empty object if none). */
  frontmatter: Record<string, unknown>;
  /** Content after the frontmatter block. */
  body: string;
  updatedAt: Date;
  sizeBytes: number;
}

export interface VaultNoteRef {
  path: string;
  updatedAt: Date;
  sizeBytes: number;
}

export interface CreateNoteInput {
  path: string;
  body: string;
  frontmatter?: Record<string, unknown>;
}

export interface UpdateNoteInput {
  /** When provided, replaces the body. Frontmatter is preserved unless {@link UpdateNoteInput.frontmatter} is provided. */
  body?: string;
  /** Merged with the existing frontmatter (shallow). Pass null values to delete a key. */
  frontmatter?: Record<string, unknown>;
}

export interface ListNotesOptions {
  prefix?: string;
  limit?: number;
}
