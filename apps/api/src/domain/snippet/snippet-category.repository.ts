import type { SnippetCategory, CreateSnippetCategoryInput, UpdateSnippetCategoryInput } from "./snippet.entity";

export interface SnippetCategoryRepository {
  findAll(): Promise<SnippetCategory[]>;
  findByValue(value: string): Promise<SnippetCategory | null>;
  create(input: CreateSnippetCategoryInput): Promise<SnippetCategory>;
  update(id: string, input: UpdateSnippetCategoryInput): Promise<SnippetCategory | null>;
  delete(id: string): Promise<boolean>;
}
