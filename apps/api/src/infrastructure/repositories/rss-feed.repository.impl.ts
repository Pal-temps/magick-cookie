import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { rssFeeds } from "../database/schema";
import type { RssFeedRepository } from "../../domain/rss/rss.repository";
import type { RssFeed, CreateRssFeedInput, UpdateRssFeedInput } from "../../domain/rss/rss.entity";

export class DrizzleRssFeedRepository implements RssFeedRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<RssFeed[]> {
    const rows = await this.db.select().from(rssFeeds).orderBy(rssFeeds.createdAt);
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<RssFeed | null> {
    const rows = await this.db.select().from(rssFeeds).where(eq(rssFeeds.id, id)).limit(1);
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async findActive(): Promise<RssFeed[]> {
    const rows = await this.db.select().from(rssFeeds).where(eq(rssFeeds.syncEnabled, true));
    return rows.map(this.toDomain);
  }

  async create(input: CreateRssFeedInput): Promise<RssFeed> {
    const rows = await this.db.insert(rssFeeds).values({
      label: input.label,
      url: input.url,
      category: input.category ?? null,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateRssFeedInput): Promise<RssFeed | null> {
    const updates: Record<string, unknown> = {};
    if (input.label !== undefined) updates.label = input.label;
    if (input.url !== undefined) updates.url = input.url;
    if (input.category !== undefined) updates.category = input.category;
    if (input.syncEnabled !== undefined) updates.syncEnabled = input.syncEnabled;

    const rows = await this.db.update(rssFeeds)
      .set(updates)
      .where(eq(rssFeeds.id, id))
      .returning();
    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async updateLastSyncedAt(id: string, date: Date, siteUrl?: string): Promise<void> {
    const updates: Record<string, unknown> = { lastSyncedAt: date };
    if (siteUrl !== undefined) updates.siteUrl = siteUrl;
    await this.db.update(rssFeeds).set(updates).where(eq(rssFeeds.id, id));
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(rssFeeds).where(eq(rssFeeds.id, id)).returning();
    return rows.length > 0;
  }

  private toDomain(row: typeof rssFeeds.$inferSelect): RssFeed {
    return {
      id: row.id,
      label: row.label,
      url: row.url,
      category: row.category,
      siteUrl: row.siteUrl,
      lastSyncedAt: row.lastSyncedAt,
      syncEnabled: row.syncEnabled,
      createdAt: row.createdAt!,
      updatedAt: row.updatedAt!,
    };
  }
}
