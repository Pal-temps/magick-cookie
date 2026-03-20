import type { RssFeedRepository, RssArticleRepository } from "../../domain/rss/rss.repository";
import type { RssFeed, RssArticle, CreateRssFeedInput, UpdateRssFeedInput } from "../../domain/rss/rss.entity";
import { fetchFeed } from "../../infrastructure/connectors/rss-parser.connector";
import { extractArticleContent } from "../../infrastructure/connectors/readability.connector";
import type { LlmService } from "../llm/llm.service";

export interface RssDigest {
  generatedAt: string;
  totalUnread: number;
  highlights: { title: string; feedLabel: string; reason: string; link: string | null }[];
  summary: string;
  categories: { name: string; count: number; topArticle: string }[];
}

const MAX_CONSECUTIVE_FAILURES = 3;

export class RssService {
  private llmService?: LlmService;
  private failCounts = new Map<string, number>();

  constructor(
    private feedRepo: RssFeedRepository,
    private articleRepo: RssArticleRepository,
  ) {}

  setLlmService(llm: LlmService) {
    this.llmService = llm;
  }

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

  async getUnreadCountPerFeed(): Promise<Record<string, number>> {
    return this.articleRepo.countUnreadPerFeed();
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
        this.failCounts.delete(feed.id); // Reset on success
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const count = (this.failCounts.get(feed.id) ?? 0) + 1;
        this.failCounts.set(feed.id, count);

        if (count >= MAX_CONSECUTIVE_FAILURES) {
          await this.feedRepo.update(feed.id, { syncEnabled: false });
          this.failCounts.delete(feed.id);
          errors.push(`${feed.label}: ${msg} — desactive apres ${count} echecs`);
        } else {
          errors.push(`${feed.label}: ${msg} (${count}/${MAX_CONSECUTIVE_FAILURES})`);
        }
      }
    }

    return { total, errors };
  }

  // --- AI Digest ---

  async generateDigest(): Promise<RssDigest> {
    if (!this.llmService) throw new Error("LLM service not configured");

    // Fetch all feeds for label mapping
    const feeds = await this.feedRepo.findAll();
    const feedMap = new Map(feeds.map((f) => [f.id, f.label]));

    // Get recent unread articles (last 24h, up to 200)
    const allUnread = await this.articleRepo.findAll({ unread: true, limit: 200 });

    // Filter to last 24h only
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    const recent = allUnread.filter((a) => {
      const pub = a.publishedAt ? new Date(a.publishedAt) : new Date(a.createdAt);
      return pub >= cutoff;
    });

    if (recent.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        totalUnread: 0,
        highlights: [],
        summary: "Aucun nouvel article dans les dernieres 24h.",
        categories: [],
      };
    }

    const articlesForLlm = recent.map((a) => ({
      feedLabel: feedMap.get(a.feedId) ?? "Inconnu",
      title: a.title ?? "(sans titre)",
      description: a.description,
      link: a.link,
      publishedAt: a.publishedAt?.toISOString?.() ?? (a.publishedAt as unknown as string) ?? null,
    }));

    const result = await this.llmService.generateRssDigest(articlesForLlm);

    return {
      generatedAt: new Date().toISOString(),
      totalUnread: recent.length,
      ...result,
    };
  }
}
