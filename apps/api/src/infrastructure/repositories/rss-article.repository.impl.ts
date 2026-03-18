import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "../database/client";
import { rssArticles } from "../database/schema";
import type { RssArticleRepository } from "../../domain/rss/rss.repository";
import type { RssArticle, CreateRssArticleInput } from "../../domain/rss/rss.entity";

export class DrizzleRssArticleRepository implements RssArticleRepository {
  constructor(private db: Database) {}

  async findByFeed(
    feedId: string,
    options?: { unread?: boolean; starred?: boolean; limit?: number; offset?: number },
  ): Promise<RssArticle[]> {
    const conditions = [eq(rssArticles.feedId, feedId)];
    if (options?.unread) conditions.push(eq(rssArticles.isRead, false));
    if (options?.starred) conditions.push(eq(rssArticles.isStarred, true));

    const rows = await this.db.select().from(rssArticles)
      .where(and(...conditions))
      .orderBy(desc(rssArticles.publishedAt))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);

    return rows.map(this.toDomain);
  }

  async findAll(
    options?: { feedId?: string; unread?: boolean; starred?: boolean; limit?: number; offset?: number },
  ): Promise<RssArticle[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (options?.feedId) conditions.push(eq(rssArticles.feedId, options.feedId));
    if (options?.unread) conditions.push(eq(rssArticles.isRead, false));
    if (options?.starred) conditions.push(eq(rssArticles.isStarred, true));

    const query = this.db.select().from(rssArticles);
    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query)
      .orderBy(desc(rssArticles.publishedAt))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);

    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<RssArticle | null> {
    const rows = await this.db.select().from(rssArticles).where(eq(rssArticles.id, id)).limit(1);
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateRssArticleInput): Promise<RssArticle | null> {
    try {
      const rows = await this.db.insert(rssArticles).values({
        feedId: input.feedId,
        guid: input.guid,
        title: input.title,
        link: input.link,
        description: input.description,
        content: input.content,
        author: input.author,
        publishedAt: input.publishedAt,
      }).onConflictDoNothing().returning();

      return rows.length > 0 ? this.toDomain(rows[0]) : null;
    } catch {
      return null;
    }
  }

  async bulkCreate(inputs: CreateRssArticleInput[]): Promise<number> {
    let count = 0;
    for (const input of inputs) {
      const result = await this.create(input);
      if (result) count++;
    }
    return count;
  }

  async updateFlags(
    id: string,
    flags: { isRead?: boolean; isStarred?: boolean },
  ): Promise<RssArticle | null> {
    const rows = await this.db.update(rssArticles)
      .set(flags)
      .where(eq(rssArticles.id, id))
      .returning();
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(rssArticles).where(eq(rssArticles.id, id)).returning();
    return rows.length > 0;
  }

  async countUnread(feedId?: string): Promise<number> {
    const conditions = [eq(rssArticles.isRead, false)];
    if (feedId) conditions.push(eq(rssArticles.feedId, feedId));

    const rows = await this.db.select({ count: sql<number>`COUNT(*)` })
      .from(rssArticles)
      .where(and(...conditions));
    return Number(rows[0]?.count ?? 0);
  }

  async markAllRead(feedId: string): Promise<number> {
    const rows = await this.db.update(rssArticles)
      .set({ isRead: true })
      .where(and(eq(rssArticles.feedId, feedId), eq(rssArticles.isRead, false)))
      .returning();
    return rows.length;
  }

  private toDomain(row: typeof rssArticles.$inferSelect): RssArticle {
    return {
      id: row.id,
      feedId: row.feedId,
      guid: row.guid,
      title: row.title,
      link: row.link,
      description: row.description,
      content: row.content,
      author: row.author,
      publishedAt: row.publishedAt,
      isRead: row.isRead,
      isStarred: row.isStarred,
      createdAt: row.createdAt!,
    };
  }
}
