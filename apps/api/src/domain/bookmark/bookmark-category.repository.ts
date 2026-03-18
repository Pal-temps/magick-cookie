import type { BookmarkCategory, CreateBookmarkCategoryInput, UpdateBookmarkCategoryInput } from "./bookmark-category.entity";

export interface BookmarkCategoryRepository {
  findAll(): Promise<BookmarkCategory[]>;
  findByValue(value: string): Promise<BookmarkCategory | null>;
  create(input: CreateBookmarkCategoryInput): Promise<BookmarkCategory>;
  update(id: string, input: UpdateBookmarkCategoryInput): Promise<BookmarkCategory | null>;
  delete(id: string): Promise<boolean>;
}
