import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { snippetCategories } from "../database/schema";
import type { SnippetCategoryRepository } from "../../domain/snippet/snippet-category.repository";
import type { SnippetCategory, CreateSnippetCategoryInput, UpdateSnippetCategoryInput } from "../../domain/snippet/snippet.entity";

export class DrizzleSnippetCategoryRepository implements SnippetCategoryRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<SnippetCategory[]> {
    const rows = await this.db.select().from(snippetCategories).orderBy(snippetCategories.sortOrder);
    return rows.map(this.toDomain);
  }

  async findByValue(value: string): Promise<SnippetCategory | null> {
    const rows = await this.db.select().from(snippetCategories).where(eq(snippetCategories.value, value));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateSnippetCategoryInput): Promise<SnippetCategory> {
    const rows = await this.db.insert(snippetCategories).values({
      value: input.value,
      label: input.label,
      sortOrder: input.sortOrder ?? 0,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateSnippetCategoryInput): Promise<SnippetCategory | null> {
    const values: Record<string, unknown> = {};
    if (input.label !== undefined) values.label = input.label;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;

    const rows = await this.db.update(snippetCategories).set(values).where(eq(snippetCategories.id, id)).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(snippetCategories).where(eq(snippetCategories.id, id)).returning({ id: snippetCategories.id });
    return rows.length > 0;
  }

  private toDomain(row: typeof snippetCategories.$inferSelect): SnippetCategory {
    return {
      id: row.id,
      value: row.value,
      label: row.label,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
    };
  }
}
