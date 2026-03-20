import { describe, test, expect, beforeEach, mock } from "bun:test";
import { RssService } from "../../application/rss/rss.service";
import type { RssFeedRepository, RssArticleRepository } from "../../domain/rss/rss.repository";
import type { RssFeed, RssArticle } from "../../domain/rss/rss.entity";
import type { LlmService } from "../../application/llm/llm.service";

// --- Factories ---

function makeFeed(overrides: Partial<RssFeed> = {}): RssFeed {
  return {
    id: "feed-1",
    label: "Tech News",
    url: "https://example.com/feed.xml",
    category: "tech",
    siteUrl: "https://example.com",
    lastSyncedAt: null,
    syncEnabled: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeArticle(overrides: Partial<RssArticle> = {}): RssArticle {
  return {
    id: "art-1",
    feedId: "feed-1",
    guid: "guid-1",
    title: "Breaking News",
    link: "https://example.com/article-1",
    description: "Some description of the article",
    content: "<p>Full content here</p>",
    author: "Author Name",
    publishedAt: new Date(), // now = within 24h
    isRead: false,
    isStarred: false,
    createdAt: new Date(),
    ...overrides,
  };
}

// --- Mocks ---

function createMockFeedRepo(): Record<keyof RssFeedRepository, ReturnType<typeof mock>> {
  return {
    findAll: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    findActive: mock(() => Promise.resolve([])),
    create: mock(() => Promise.resolve(makeFeed())),
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
    delete: mock(() => Promise.resolve(false)),
    countUnread: mock(() => Promise.resolve(0)),
    markAllRead: mock(() => Promise.resolve(0)),
    updateContent: mock(() => Promise.resolve(null)),
    deleteOlderThan: mock(() => Promise.resolve(0)),
  };
}

function createMockLlmService(): Record<"generateRssDigest", ReturnType<typeof mock>> {
  return {
    generateRssDigest: mock(() =>
      Promise.resolve({
        highlights: [
          { title: "Breaking News", feedLabel: "Tech News", reason: "Important update", link: "https://example.com/article-1" },
        ],
        summary: "Today's tech news focuses on AI advancements.",
        categories: [
          { name: "Tech", count: 1, topArticle: "Breaking News" },
        ],
      })
    ),
  };
}

// --- Tests ---

describe("RssService — generateDigest", () => {
  let service: RssService;
  let feedRepo: ReturnType<typeof createMockFeedRepo>;
  let articleRepo: ReturnType<typeof createMockArticleRepo>;
  let llmService: ReturnType<typeof createMockLlmService>;

  beforeEach(() => {
    feedRepo = createMockFeedRepo();
    articleRepo = createMockArticleRepo();
    llmService = createMockLlmService();
    service = new RssService(
      feedRepo as unknown as RssFeedRepository,
      articleRepo as unknown as RssArticleRepository,
    );
    service.setLlmService(llmService as unknown as LlmService);
  });

  // =========================================================================
  // Empty digest
  // =========================================================================

  test("returns empty digest when no unread articles", async () => {
    feedRepo.findAll.mockReturnValue(Promise.resolve([makeFeed()]));
    articleRepo.findAll.mockReturnValue(Promise.resolve([]));

    const digest = await service.generateDigest();

    expect(digest.totalUnread).toBe(0);
    expect(digest.highlights).toEqual([]);
    expect(digest.categories).toEqual([]);
    expect(digest.summary).toContain("Aucun");
    expect(digest.generatedAt).toBeDefined();
    expect(llmService.generateRssDigest).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Calls LLM with correct data
  // =========================================================================

  test("calls LLM with correct article data and feed labels", async () => {
    const feed1 = makeFeed({ id: "feed-1", label: "Tech News" });
    const feed2 = makeFeed({ id: "feed-2", label: "Science Daily" });
    feedRepo.findAll.mockReturnValue(Promise.resolve([feed1, feed2]));

    const art1 = makeArticle({ id: "art-1", feedId: "feed-1", title: "AI Update", publishedAt: new Date(), link: "https://ex.com/1", description: "AI stuff" });
    const art2 = makeArticle({ id: "art-2", feedId: "feed-2", title: "New Planet", publishedAt: new Date(), link: "https://ex.com/2", description: "Space stuff" });
    articleRepo.findAll.mockReturnValue(Promise.resolve([art1, art2]));

    await service.generateDigest();

    expect(llmService.generateRssDigest).toHaveBeenCalledTimes(1);
    const callArg = llmService.generateRssDigest.mock.calls[0][0];
    expect(callArg).toHaveLength(2);
    expect(callArg[0].feedLabel).toBe("Tech News");
    expect(callArg[0].title).toBe("AI Update");
    expect(callArg[0].link).toBe("https://ex.com/1");
    expect(callArg[1].feedLabel).toBe("Science Daily");
    expect(callArg[1].title).toBe("New Planet");
  });

  // =========================================================================
  // Filters to last 24h only
  // =========================================================================

  test("filters articles to last 24h only", async () => {
    feedRepo.findAll.mockReturnValue(Promise.resolve([makeFeed()]));

    const recent = makeArticle({ id: "art-recent", title: "Recent", publishedAt: new Date() });
    const old = makeArticle({
      id: "art-old",
      title: "Old Article",
      publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h ago
    });
    articleRepo.findAll.mockReturnValue(Promise.resolve([recent, old]));

    await service.generateDigest();

    expect(llmService.generateRssDigest).toHaveBeenCalledTimes(1);
    const callArg = llmService.generateRssDigest.mock.calls[0][0];
    expect(callArg).toHaveLength(1);
    expect(callArg[0].title).toBe("Recent");
  });

  // =========================================================================
  // Returns structured digest
  // =========================================================================

  test("returns structured digest with highlights, summary, categories", async () => {
    feedRepo.findAll.mockReturnValue(Promise.resolve([makeFeed()]));
    articleRepo.findAll.mockReturnValue(Promise.resolve([makeArticle()]));

    const digest = await service.generateDigest();

    expect(digest.generatedAt).toBeDefined();
    expect(typeof digest.generatedAt).toBe("string");
    expect(digest.totalUnread).toBe(1);
    expect(digest.highlights).toHaveLength(1);
    expect(digest.highlights[0].title).toBe("Breaking News");
    expect(digest.highlights[0].reason).toBe("Important update");
    expect(digest.summary).toBe("Today's tech news focuses on AI advancements.");
    expect(digest.categories).toHaveLength(1);
    expect(digest.categories[0].name).toBe("Tech");
    expect(digest.categories[0].count).toBe(1);
  });

  // =========================================================================
  // LLM not configured
  // =========================================================================

  test("throws error when LLM service not configured", async () => {
    // Create a service without LLM
    const serviceNoLlm = new RssService(
      feedRepo as unknown as RssFeedRepository,
      articleRepo as unknown as RssArticleRepository,
    );

    await expect(serviceNoLlm.generateDigest()).rejects.toThrow("LLM service not configured");
  });

  // =========================================================================
  // LLM returns empty/error gracefully
  // =========================================================================

  test("handles LLM returning empty result gracefully", async () => {
    feedRepo.findAll.mockReturnValue(Promise.resolve([makeFeed()]));
    articleRepo.findAll.mockReturnValue(Promise.resolve([makeArticle()]));

    llmService.generateRssDigest.mockReturnValue(
      Promise.resolve({ highlights: [], summary: "", categories: [] })
    );

    const digest = await service.generateDigest();

    expect(digest.totalUnread).toBe(1);
    expect(digest.highlights).toEqual([]);
    expect(digest.summary).toBe("");
    expect(digest.categories).toEqual([]);
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  test("uses createdAt as fallback when publishedAt is null", async () => {
    feedRepo.findAll.mockReturnValue(Promise.resolve([makeFeed()]));

    const artNoPublished = makeArticle({
      id: "art-no-pub",
      title: "No Pub Date",
      publishedAt: null,
      createdAt: new Date(), // now = within 24h
    });
    articleRepo.findAll.mockReturnValue(Promise.resolve([artNoPublished]));

    await service.generateDigest();

    expect(llmService.generateRssDigest).toHaveBeenCalledTimes(1);
    const callArg = llmService.generateRssDigest.mock.calls[0][0];
    expect(callArg).toHaveLength(1);
    expect(callArg[0].title).toBe("No Pub Date");
  });

  test("maps unknown feedId to 'Inconnu'", async () => {
    feedRepo.findAll.mockReturnValue(Promise.resolve([makeFeed({ id: "feed-1" })]));

    const artUnknownFeed = makeArticle({
      id: "art-unknown",
      feedId: "feed-nonexistent",
      title: "Mystery Article",
      publishedAt: new Date(),
    });
    articleRepo.findAll.mockReturnValue(Promise.resolve([artUnknownFeed]));

    await service.generateDigest();

    const callArg = llmService.generateRssDigest.mock.calls[0][0];
    expect(callArg[0].feedLabel).toBe("Inconnu");
  });

  test("returns empty digest when all unread articles are older than 24h", async () => {
    feedRepo.findAll.mockReturnValue(Promise.resolve([makeFeed()]));

    const oldArticle = makeArticle({
      id: "art-old",
      publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });
    articleRepo.findAll.mockReturnValue(Promise.resolve([oldArticle]));

    const digest = await service.generateDigest();

    expect(digest.totalUnread).toBe(0);
    expect(digest.highlights).toEqual([]);
    expect(llmService.generateRssDigest).not.toHaveBeenCalled();
  });
});
