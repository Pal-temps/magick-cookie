import type { Bookmark, CreateBookmarkInput, UpdateBookmarkInput } from "./bookmark.entity";

export interface BookmarkRepository {
  findAll(): Promise<Bookmark[]>;
  findById(id: string): Promise<Bookmark | null>;
  create(input: CreateBookmarkInput): Promise<Bookmark>;
  update(id: string, input: UpdateBookmarkInput): Promise<Bookmark | null>;
  delete(id: string): Promise<boolean>;
}
