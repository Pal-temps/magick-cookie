import type { BookmarkRepository } from "../../domain/bookmark/bookmark.repository";
import type { Bookmark, CreateBookmarkInput, UpdateBookmarkInput } from "../../domain/bookmark/bookmark.entity";
import type { BookmarkCategoryRepository } from "../../domain/bookmark/bookmark-category.repository";
import type { BookmarkCategory, CreateBookmarkCategoryInput, UpdateBookmarkCategoryInput } from "../../domain/bookmark/bookmark-category.entity";

export class BookmarkService {
  constructor(
    private bookmarkRepo: BookmarkRepository,
    private bookmarkCategoryRepo: BookmarkCategoryRepository,
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

  // --- Category CRUD ---

  async getAllCategories(): Promise<BookmarkCategory[]> {
    return this.bookmarkCategoryRepo.findAll();
  }

  async createCategory(input: CreateBookmarkCategoryInput): Promise<BookmarkCategory> {
    return this.bookmarkCategoryRepo.create(input);
  }

  async updateCategory(id: string, input: UpdateBookmarkCategoryInput): Promise<BookmarkCategory | null> {
    return this.bookmarkCategoryRepo.update(id, input);
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.bookmarkCategoryRepo.delete(id);
  }
}
