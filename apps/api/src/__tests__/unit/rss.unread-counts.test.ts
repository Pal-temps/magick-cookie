import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { RssFeedRepository, RssArticleRepository } from "../../domain/rss/rss.repository";
import type { RssFeed, RssArticle } from "../../domain/rss/rss.entity";

// Mock rss-parser before any import touches it
mock.module("rss-parser", () => ({
  default: class { parseURL = mock(() => Promise.resolve({ items: [], link: null })); },
}));

mock.module("../../infrastructure/connectors/rss-parser.connector", () => ({
  fetchFeed: mock(() => Promise.resolve({ siteUrl: null, items: [] })),
}));

mock.module("../../infrastructure/connectors/readability.connector", () => ({
  extractArticleContent: mock(() => Promise.resolve({ title: "", content: "", textContent: "", excerpt: "" })),
}));

const { RssService } = await import("../../application/rss/rss.service");

function createMockFeedRepo(): Record<keyof RssFeedRepository, ReturnType<typeof mock>> {
  return {
    findAll: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    findActive: mock(() => Promise.resolve([])),
    create: mock(() => Promise.resolve({} as RssFeed)),
    update: mock(() => Promise.resolve(null)),
    updateLastSyncedAt: mock(() => Promise.resolve()),
    delete: mock(() => Promise.resolve(false)),
  };
}

function createMockArticleRepo(): Record<keyof RssArticleRepository, ReturnType<typeof mock>> {
  return {
    findByFeed: mock(() => Promise.resolve([])),
    findAll: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve(null)),
    bulkCreate: mock(() => Promise.resolve(0)),
    updateFlags: mock(() => Promise.resolve(null)),
    markAllRead: mock(() => Promise.resolve(0)),
    delete: mock(() => Promise.resolve(false)),
    countUnread: mock(() => Promise.resolve(0)),
    countUnreadPerFeed: mock(() => Promise.resolve({})),
    updateContent: mock(() => Promise.resolve(null)),
    deleteOlderThan: mock(() => Promise.resolve(0)),
  };
}

describe("RssService – getUnreadCountPerFeed", () => {
  let service: InstanceType<typeof RssService>;
  let feedRepo: ReturnType<typeof createMockFeedRepo>;
  let articleRepo: ReturnType<typeof createMockArticleRepo>;

  beforeEach(() => {
    feedRepo = createMockFeedRepo();
    articleRepo = createMockArticleRepo();
    service = new RssService(feedRepo as any, articleRepo as any);
  });

  it("returns empty object when no unread articles", async () => {
    articleRepo.countUnreadPerFeed.mockReturnValue(Promise.resolve({}));

    const result = await service.getUnreadCountPerFeed();

    expect(result).toEqual({});
  });

  it("returns correct counts per feed", async () => {
    const counts: Record<string, number> = {
      "feed-1": 5,
      "feed-2": 12,
      "feed-3": 1,
    };
    articleRepo.countUnreadPerFeed.mockReturnValue(Promise.resolve(counts));

    const result = await service.getUnreadCountPerFeed();

    expect(result).toEqual({ "feed-1": 5, "feed-2": 12, "feed-3": 1 });
  });

  it("delegates to articleRepo.countUnreadPerFeed()", async () => {
    await service.getUnreadCountPerFeed();

    expect(articleRepo.countUnreadPerFeed).toHaveBeenCalledTimes(1);
  });
});
