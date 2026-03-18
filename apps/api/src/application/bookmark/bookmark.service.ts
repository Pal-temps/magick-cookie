import type { BookmarkRepository } from "../../domain/bookmark/bookmark.repository";
import type { Bookmark, CreateBookmarkInput, UpdateBookmarkInput } from "../../domain/bookmark/bookmark.entity";
import type { BookmarkTagRepository } from "../../domain/bookmark/bookmark-tag.repository";
import type { BookmarkTag, CreateBookmarkTagInput, UpdateBookmarkTagInput } from "../../domain/bookmark/bookmark-tag.entity";

export class BookmarkService {
  constructor(
    private bookmarkRepo: BookmarkRepository,
    private bookmarkTagRepo: BookmarkTagRepository,
  ) {}

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

  // --- Tag CRUD ---

  async getAllTags(): Promise<BookmarkTag[]> {
    return this.bookmarkTagRepo.findAll();
  }

  async createTag(input: CreateBookmarkTagInput): Promise<BookmarkTag> {
    return this.bookmarkTagRepo.create(input);
  }

  async updateTag(id: string, input: UpdateBookmarkTagInput): Promise<BookmarkTag | null> {
    return this.bookmarkTagRepo.update(id, input);
  }

  async deleteTag(id: string): Promise<boolean> {
    return this.bookmarkTagRepo.delete(id);
  }
}
