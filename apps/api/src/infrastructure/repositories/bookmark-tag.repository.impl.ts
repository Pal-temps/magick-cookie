import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { bookmarkTags } from "../database/schema";
import type { BookmarkTagRepository } from "../../domain/bookmark/bookmark-tag.repository";
import type { BookmarkTag, CreateBookmarkTagInput, UpdateBookmarkTagInput } from "../../domain/bookmark/bookmark-tag.entity";

export class DrizzleBookmarkTagRepository implements BookmarkTagRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<BookmarkTag[]> {
    const rows = await this.db.select().from(bookmarkTags).orderBy(bookmarkTags.sortOrder);
    return rows.map(this.toDomain);
  }

  async findByValue(value: string): Promise<BookmarkTag | null> {
    const rows = await this.db.select().from(bookmarkTags).where(eq(bookmarkTags.value, value));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateBookmarkTagInput): Promise<BookmarkTag> {
    const rows = await this.db.insert(bookmarkTags).values({
      value: input.value,
      label: input.label,
      sortOrder: input.sortOrder ?? 0,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateBookmarkTagInput): Promise<BookmarkTag | null> {
    const values: Record<string, unknown> = {};
    if (input.label !== undefined) values.label = input.label;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;

    const rows = await this.db.update(bookmarkTags).set(values).where(eq(bookmarkTags.id, id)).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(bookmarkTags).where(eq(bookmarkTags.id, id)).returning({ id: bookmarkTags.id });
    return rows.length > 0;
  }

  private toDomain(row: typeof bookmarkTags.$inferSelect): BookmarkTag {
    return {
      id: row.id,
      value: row.value,
      label: row.label,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
    };
  }
}
