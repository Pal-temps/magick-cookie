import type { SnippetRepository, SnippetFindAllOptions } from "../../domain/snippet/snippet.repository";
import type { Snippet, CreateSnippetInput, UpdateSnippetInput } from "../../domain/snippet/snippet.entity";

export class SnippetService {
  constructor(private snippetRepo: SnippetRepository) {}

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
}
