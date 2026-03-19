import type { RssFeedRepository, RssArticleRepository } from "../../domain/rss/rss.repository";
import type { RssFeed, RssArticle, CreateRssFeedInput, UpdateRssFeedInput } from "../../domain/rss/rss.entity";
import { fetchFeed } from "../../infrastructure/connectors/rss-parser.connector";
import { extractArticleContent } from "../../infrastructure/connectors/readability.connector";

export class RssService {
  constructor(
    private feedRepo: RssFeedRepository,
    private articleRepo: RssArticleRepository,
  ) {}

  // --- Feeds ---

  async getFeeds(): Promise<RssFeed[]> {
    return this.feedRepo.findAll();
  }

  async getFeedById(id: string): Promise<RssFeed | null> {
    return this.feedRepo.findById(id);
  }

  async createFeed(input: CreateRssFeedInput): Promise<RssFeed> {
    return this.feedRepo.create(input);
  }

  async updateFeed(id: string, input: UpdateRssFeedInput): Promise<RssFeed | null> {
    return this.feedRepo.update(id, input);
  }

  async deleteFeed(id: string): Promise<boolean> {
    return this.feedRepo.delete(id);
  }

  // --- Articles ---

  async getArticles(options?: { feedId?: string; unread?: boolean; starred?: boolean; limit?: number; offset?: number }): Promise<RssArticle[]> {
    if (options?.feedId) {
      return this.articleRepo.findByFeed(options.feedId, options);
    }
    return this.articleRepo.findAll(options);
  }

  async getArticleById(id: string): Promise<RssArticle | null> {
    return this.articleRepo.findById(id);
  }

  async updateArticleFlags(id: string, flags: { isRead?: boolean; isStarred?: boolean }): Promise<RssArticle | null> {
    return this.articleRepo.updateFlags(id, flags);
  }

  async deleteArticle(id: string): Promise<boolean> {
    return this.articleRepo.delete(id);
  }

  async getUnreadCount(feedId?: string): Promise<number> {
    return this.articleRepo.countUnread(feedId);
  }

  async markAllRead(feedId: string): Promise<number> {
    return this.articleRepo.markAllRead(feedId);
  }

  // --- Full content ---

  async fetchFullContent(id: string): Promise<RssArticle | null> {
    const article = await this.articleRepo.findById(id);
    if (!article) return null;

    // Return cached if already fetched
    if (article.content && article.content.length > 500) {
      return article;
    }

    if (!article.link) return article;

    try {
      const extracted = await extractArticleContent(article.link);
      return await this.articleRepo.updateContent(id, extracted.content);
    } catch (err) {
      console.error(`[rss] Failed to extract full content for ${article.link}:`, err);
      return article;
    }
  }

  // --- Sync ---

  async syncFeed(feedId: string): Promise<{ newArticles: number }> {
    const feed = await this.feedRepo.findById(feedId);
    if (!feed) throw new Error("Feed not found");

    const parsed = await fetchFeed(feed.url);
    const inputs = parsed.items.map((item) => ({
      feedId,
      guid: item.guid,
      title: item.title,
      link: item.link,
      description: item.description,
      content: item.content,
      author: item.author,
      publishedAt: item.publishedAt,
    }));

    const newArticles = await this.articleRepo.bulkCreate(inputs);
    await this.feedRepo.updateLastSyncedAt(feedId, new Date(), parsed.siteUrl ?? undefined);

    return { newArticles };
  }

  async cleanupOldArticles(retentionDays: number): Promise<number> {
    const before = new Date();
    before.setDate(before.getDate() - retentionDays);
    const deleted = await this.articleRepo.deleteOlderThan(before);
    if (deleted > 0) {
      console.log(`[rss-cleanup] Deleted ${deleted} articles older than ${retentionDays} days (starred preserved)`);
    }
    return deleted;
  }

  async syncAll(): Promise<{ total: number; errors: string[] }> {
    const feeds = await this.feedRepo.findActive();
    let total = 0;
    const errors: string[] = [];

    for (const feed of feeds) {
      try {
        const result = await this.syncFeed(feed.id);
        total += result.newArticles;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${feed.label}: ${msg}`);
        console.error(`[rss-sync] Failed to sync ${feed.label}:`, err);
      }
    }

    return { total, errors };
  }
}
