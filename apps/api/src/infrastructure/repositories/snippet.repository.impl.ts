import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "../database/client";
import { snippets } from "../database/schema";
import type { SnippetRepository, SnippetFindAllOptions } from "../../domain/snippet/snippet.repository";
import type { Snippet, CreateSnippetInput, UpdateSnippetInput } from "../../domain/snippet/snippet.entity";

export class DrizzleSnippetRepository implements SnippetRepository {
  constructor(private db: Database) {}

  async findAll(options?: SnippetFindAllOptions): Promise<Snippet[]> {
    const conditions = [];
    if (options?.tag) conditions.push(sql`${snippets.tags} LIKE ${"%" + JSON.stringify(options.tag).slice(0, -1) + "%"}`);
    if (options?.language) conditions.push(eq(snippets.language, options.language));

    let query = this.db
      .select()
      .from(snippets)
      .orderBy(desc(snippets.updatedAt))
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const rows = await query;
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<Snippet | null> {
    const rows = await this.db.select().from(snippets).where(eq(snippets.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateSnippetInput): Promise<Snippet> {
    const rows = await this.db.insert(snippets).values({
      title: input.title,
      content: input.content,
      language: input.language ?? "text",
      tags: JSON.stringify(input.tags ?? []),
      isFavorite: input.isFavorite ?? false,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateSnippetInput): Promise<Snippet | null> {
    const values: Record<string, unknown> = {};
    if (input.title !== undefined) values.title = input.title;
    if (input.content !== undefined) values.content = input.content;
    if (input.language !== undefined) values.language = input.language;
    if (input.tags !== undefined) values.tags = JSON.stringify(input.tags);
    if (input.isFavorite !== undefined) values.isFavorite = input.isFavorite;

    const rows = await this.db.update(snippets).set(values).where(eq(snippets.id, id)).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(snippets).where(eq(snippets.id, id)).returning({ id: snippets.id });
    return rows.length > 0;
  }

  private toDomain(row: typeof snippets.$inferSelect): Snippet {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      language: row.language,
      tags: JSON.parse(row.tags) as string[],
      isFavorite: row.isFavorite,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
