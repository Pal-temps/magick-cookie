import type { RssFeed, RssArticle, CreateRssFeedInput, UpdateRssFeedInput, CreateRssArticleInput } from "./rss.entity";

export interface RssFeedRepository {
  findAll(): Promise<RssFeed[]>;
  findById(id: string): Promise<RssFeed | null>;
  findActive(): Promise<RssFeed[]>;
  create(input: CreateRssFeedInput): Promise<RssFeed>;
  update(id: string, input: UpdateRssFeedInput): Promise<RssFeed | null>;
  updateLastSyncedAt(id: string, date: Date, siteUrl?: string): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export interface RssArticleRepository {
  findByFeed(feedId: string, options?: { unread?: boolean; starred?: boolean; limit?: number; offset?: number }): Promise<RssArticle[]>;
  findAll(options?: { feedId?: string; unread?: boolean; starred?: boolean; limit?: number; offset?: number }): Promise<RssArticle[]>;
  findById(id: string): Promise<RssArticle | null>;
  create(input: CreateRssArticleInput): Promise<RssArticle | null>;
  bulkCreate(inputs: CreateRssArticleInput[]): Promise<number>;
  updateFlags(id: string, flags: { isRead?: boolean; isStarred?: boolean }): Promise<RssArticle | null>;
  delete(id: string): Promise<boolean>;
  countUnread(feedId?: string): Promise<number>;
  markAllRead(feedId: string): Promise<number>;
  updateContent(id: string, content: string): Promise<RssArticle | null>;
  deleteOlderThan(before: Date): Promise<number>;
}
