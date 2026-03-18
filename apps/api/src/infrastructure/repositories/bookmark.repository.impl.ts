import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { bookmarks } from "../database/schema";
import type { BookmarkRepository } from "../../domain/bookmark/bookmark.repository";
import type { Bookmark, CreateBookmarkInput, UpdateBookmarkInput } from "../../domain/bookmark/bookmark.entity";

export class DrizzleBookmarkRepository implements BookmarkRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<Bookmark[]> {
    const rows = await this.db.select().from(bookmarks).orderBy(bookmarks.sortOrder);
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<Bookmark | null> {
    const rows = await this.db.select().from(bookmarks).where(eq(bookmarks.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateBookmarkInput): Promise<Bookmark> {
    const rows = await this.db.insert(bookmarks).values({
      name: input.name,
      url: input.url,
      emoji: input.emoji ?? null,
      tag: input.tag ?? "none",
      isFavorite: input.isFavorite ?? false,
      sortOrder: input.sortOrder ?? 0,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateBookmarkInput): Promise<Bookmark | null> {
    const values: Record<string, unknown> = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.url !== undefined) values.url = input.url;
    if (input.emoji !== undefined) values.emoji = input.emoji;
    if (input.isFavorite !== undefined) values.isFavorite = input.isFavorite;
    if (input.tag !== undefined) values.tag = input.tag;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;

    const rows = await this.db.update(bookmarks).set(values).where(eq(bookmarks.id, id)).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(bookmarks).where(eq(bookmarks.id, id)).returning({ id: bookmarks.id });
    return rows.length > 0;
  }

  private toDomain(row: typeof bookmarks.$inferSelect): Bookmark {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      emoji: row.emoji,
      tag: row.tag ?? "none",
      isFavorite: row.isFavorite,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
