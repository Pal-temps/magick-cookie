import type { Snippet, CreateSnippetInput, UpdateSnippetInput } from "./snippet.entity";

export interface SnippetFindAllOptions {
  category?: string;
  language?: string;
  limit?: number;
  offset?: number;
}

export interface SnippetRepository {
  findAll(options?: SnippetFindAllOptions): Promise<Snippet[]>;
  findById(id: string): Promise<Snippet | null>;
  create(input: CreateSnippetInput): Promise<Snippet>;
  update(id: string, input: UpdateSnippetInput): Promise<Snippet | null>;
  delete(id: string): Promise<boolean>;
}
