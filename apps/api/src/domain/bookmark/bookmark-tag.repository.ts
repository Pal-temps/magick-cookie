import type { BookmarkTag, CreateBookmarkTagInput, UpdateBookmarkTagInput } from "./bookmark-tag.entity";

export interface BookmarkTagRepository {
  findAll(): Promise<BookmarkTag[]>;
  findByValue(value: string): Promise<BookmarkTag | null>;
  create(input: CreateBookmarkTagInput): Promise<BookmarkTag>;
  update(id: string, input: UpdateBookmarkTagInput): Promise<BookmarkTag | null>;
  delete(id: string): Promise<boolean>;
}
