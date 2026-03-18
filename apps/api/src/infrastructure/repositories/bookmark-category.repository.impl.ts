import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { bookmarkCategories } from "../database/schema";
import type { BookmarkCategoryRepository } from "../../domain/bookmark/bookmark-category.repository";
import type { BookmarkCategory, CreateBookmarkCategoryInput, UpdateBookmarkCategoryInput } from "../../domain/bookmark/bookmark-category.entity";

export class DrizzleBookmarkCategoryRepository implements BookmarkCategoryRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<BookmarkCategory[]> {
    const rows = await this.db.select().from(bookmarkCategories).orderBy(bookmarkCategories.sortOrder);
    return rows.map(this.toDomain);
  }

  async findByValue(value: string): Promise<BookmarkCategory | null> {
    const rows = await this.db.select().from(bookmarkCategories).where(eq(bookmarkCategories.value, value));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateBookmarkCategoryInput): Promise<BookmarkCategory> {
    const rows = await this.db.insert(bookmarkCategories).values({
      value: input.value,
      label: input.label,
      sortOrder: input.sortOrder ?? 0,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateBookmarkCategoryInput): Promise<BookmarkCategory | null> {
    const values: Record<string, unknown> = {};
    if (input.label !== undefined) values.label = input.label;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;

    const rows = await this.db.update(bookmarkCategories).set(values).where(eq(bookmarkCategories.id, id)).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(bookmarkCategories).where(eq(bookmarkCategories.id, id)).returning({ id: bookmarkCategories.id });
    return rows.length > 0;
  }

  private toDomain(row: typeof bookmarkCategories.$inferSelect): BookmarkCategory {
    return {
      id: row.id,
      value: row.value,
      label: row.label,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
    };
  }
}
