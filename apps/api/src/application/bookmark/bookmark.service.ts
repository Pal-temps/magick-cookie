import type { BookmarkRepository } from "../../domain/bookmark/bookmark.repository";
import type { Bookmark, CreateBookmarkInput, UpdateBookmarkInput } from "../../domain/bookmark/bookmark.entity";

export class BookmarkService {
  constructor(private bookmarkRepo: BookmarkRepository) {}

  async getAll(): Promise<Bookmark[]> {
    return this.bookmarkRepo.findAll();
  }

  async getById(id: string): Promise<Bookmark | null> {
    return this.bookmarkRepo.findById(id);
  }

  async create(input: CreateBookmarkInput): Promise<Bookmark> {
    return this.bookmarkRepo.create(input);
  }

  async update(id: string, input: UpdateBookmarkInput): Promise<Bookmark | null> {
    return this.bookmarkRepo.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.bookmarkRepo.delete(id);
  }
}
