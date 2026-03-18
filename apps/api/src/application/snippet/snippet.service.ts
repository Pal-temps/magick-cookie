import type { SnippetRepository, SnippetFindAllOptions } from "../../domain/snippet/snippet.repository";
import type { Snippet, CreateSnippetInput, UpdateSnippetInput } from "../../domain/snippet/snippet.entity";
import type { SnippetCategoryRepository } from "../../domain/snippet/snippet-category.repository";
import type { SnippetCategory, CreateSnippetCategoryInput, UpdateSnippetCategoryInput } from "../../domain/snippet/snippet.entity";

export class SnippetService {
  constructor(
    private snippetRepo: SnippetRepository,
    private snippetCategoryRepo: SnippetCategoryRepository,
  ) {}

  // --- Snippet CRUD ---

  async getAll(options?: SnippetFindAllOptions): Promise<Snippet[]> {
    return this.snippetRepo.findAll(options);
  }

  async getById(id: string): Promise<Snippet | null> {
    return this.snippetRepo.findById(id);
  }

  async create(input: CreateSnippetInput): Promise<Snippet> {
    return this.snippetRepo.create(input);
  }

  async update(id: string, input: UpdateSnippetInput): Promise<Snippet | null> {
    return this.snippetRepo.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.snippetRepo.delete(id);
  }

  // --- Category CRUD ---

  async getAllCategories(): Promise<SnippetCategory[]> {
    return this.snippetCategoryRepo.findAll();
  }

  async createCategory(input: CreateSnippetCategoryInput): Promise<SnippetCategory> {
    return this.snippetCategoryRepo.create(input);
  }

  async updateCategory(id: string, input: UpdateSnippetCategoryInput): Promise<SnippetCategory | null> {
    return this.snippetCategoryRepo.update(id, input);
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.snippetCategoryRepo.delete(id);
  }
}
