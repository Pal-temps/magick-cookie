import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { RssFeedRepository, RssArticleRepository } from "../../domain/rss/rss.repository";
import type { RssFeed, RssArticle } from "../../domain/rss/rss.entity";

// Mock rss-parser before any import touches it
mock.module("rss-parser", () => ({
  default: class { parseURL = mock(() => Promise.resolve({ items: [], link: null })); },
}));

// Mock the connector's fetchFeed
const mockFetchFeed = mock(() => Promise.resolve({ siteUrl: null, items: [] as any[] }));
mock.module("../../infrastructure/connectors/rss-parser.connector", () => ({
  fetchFeed: (...args: any[]) => mockFetchFeed(...args),
}));

// Mock readability connector
const mockExtractContent = mock(() => Promise.resolve({ title: "Full Title", content: "<p>Full article content here...</p>".repeat(50), textContent: "Full article", excerpt: "Excerpt" }));
mock.module("../../infrastructure/connectors/readability.connector", () => ({
  extractArticleContent: (...args: any[]) => mockExtractContent(...args),
}));

// Now import the service (after mocks are set up)
const { RssService } = await import("../../application/rss/rss.service");

const makeFeed = (overrides: Partial<RssFeed> = {}): RssFeed => ({
  id: "f-1", label: "My Feed", url: "https://example.com/rss", category: null, siteUrl: null, lastSyncedAt: null, syncEnabled: true, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), ...overrides,
});

const makeArticle = (overrides: Partial<RssArticle> = {}): RssArticle => ({
  id: "a-1", feedId: "f-1", guid: "guid-1", title: "Article 1", link: "https://example.com/1", description: "Desc", content: null, author: null, publishedAt: new Date("2026-03-15"), isRead: false, isStarred: false, createdAt: new Date("2026-03-15"), ...overrides,
});

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
    markAllRead: mock(() => Promise.resolve(0)),
    delete: mock(() => Promise.resolve(false)),
    countUnread: mock(() => Promise.resolve(0)),
    countUnreadPerFeed: mock(() => Promise.resolve({})),
    updateContent: mock(() => Promise.resolve(null)),
    deleteOlderThan: mock(() => Promise.resolve(0)),
  };
}

describe("RssService", () => {
  let service: InstanceType<typeof RssService>;
  let feedRepo: ReturnType<typeof createMockFeedRepo>;
  let articleRepo: ReturnType<typeof createMockArticleRepo>;

  beforeEach(() => {
    feedRepo = createMockFeedRepo();
    articleRepo = createMockArticleRepo();
    service = new RssService(feedRepo as any, articleRepo as any);
    mockFetchFeed.mockReset();
    mockFetchFeed.mockImplementation(() => Promise.resolve({ siteUrl: null, items: [] }));
    mockExtractContent.mockReset();
    mockExtractContent.mockImplementation(() => Promise.resolve({ title: "Full Title", content: "<p>Full content</p>".repeat(50), textContent: "Full content", excerpt: "Excerpt" }));
  });

  // --- Feeds ---
  it("getFeeds returns all feeds", async () => {
    feedRepo.findAll.mockReturnValue(Promise.resolve([makeFeed()]));
    expect(await service.getFeeds()).toHaveLength(1);
  });

  it("getFeedById returns feed when found", async () => {
    feedRepo.findById.mockReturnValue(Promise.resolve(makeFeed()));
    expect((await service.getFeedById("f-1"))!.id).toBe("f-1");
  });

  it("getFeedById returns null when not found", async () => {
    expect(await service.getFeedById("x")).toBeNull();
  });

  it("createFeed delegates to repo", async () => {
    const input = { label: "Test", url: "https://test.com/rss" };
    await service.createFeed(input);
    expect(feedRepo.create).toHaveBeenCalledWith(input);
  });

  it("updateFeed returns updated feed", async () => {
    feedRepo.update.mockReturnValue(Promise.resolve(makeFeed({ label: "New" })));
    const result = await service.updateFeed("f-1", { label: "New" });
    expect(result!.label).toBe("New");
  });

  it("deleteFeed returns true when deleted", async () => {
    feedRepo.delete.mockReturnValue(Promise.resolve(true));
    expect(await service.deleteFeed("f-1")).toBe(true);
  });

  // --- Articles ---
  it("getArticles delegates to repo", async () => {
    articleRepo.findAll.mockReturnValue(Promise.resolve([makeArticle()]));
    expect(await service.getArticles()).toHaveLength(1);
  });

  it("getArticleById returns article", async () => {
    articleRepo.findById.mockReturnValue(Promise.resolve(makeArticle()));
    expect((await service.getArticleById("a-1"))!.title).toBe("Article 1");
  });

  it("updateArticleFlags delegates to repo", async () => {
    articleRepo.updateFlags.mockReturnValue(Promise.resolve(makeArticle({ isRead: true })));
    const result = await service.updateArticleFlags("a-1", { isRead: true });
    expect(result!.isRead).toBe(true);
  });

  it("getUnreadCount delegates to repo", async () => {
    articleRepo.countUnread.mockReturnValue(Promise.resolve(5));
    expect(await service.getUnreadCount()).toBe(5);
  });

  it("markAllRead delegates to repo", async () => {
    articleRepo.markAllRead.mockReturnValue(Promise.resolve(3));
    expect(await service.markAllRead("f-1")).toBe(3);
  });

  // --- Sync ---
  it("syncFeed fetches and stores articles", async () => {
    feedRepo.findById.mockReturnValue(Promise.resolve(makeFeed()));
    mockFetchFeed.mockImplementation(() => Promise.resolve({
      siteUrl: "https://example.com",
      items: [{ guid: "g1", title: "Art", link: "https://example.com/1", description: "D", content: null, author: null, publishedAt: new Date() }],
    }));
    articleRepo.bulkCreate.mockReturnValue(Promise.resolve(1));

    const result = await service.syncFeed("f-1");

    expect(result.newArticles).toBe(1);
    expect(mockFetchFeed).toHaveBeenCalledWith("https://example.com/rss");
    expect(articleRepo.bulkCreate).toHaveBeenCalledTimes(1);
    expect(feedRepo.updateLastSyncedAt).toHaveBeenCalledTimes(1);
  });

  it("syncFeed throws when feed not found", async () => {
    await expect(service.syncFeed("x")).rejects.toThrow();
  });

  it("syncAll syncs all active feeds", async () => {
    feedRepo.findActive.mockReturnValue(Promise.resolve([makeFeed(), makeFeed({ id: "f-2", url: "https://b.com/rss" })]));
    feedRepo.findById.mockImplementation((id: string) => Promise.resolve(makeFeed({ id })));
    articleRepo.bulkCreate.mockReturnValue(Promise.resolve(2));

    const result = await service.syncAll();
    expect(result.total).toBe(4); // 2 per feed
    expect(result.errors).toHaveLength(0);
  });

  it("syncAll captures errors per feed with failure counter", async () => {
    feedRepo.findActive.mockReturnValue(Promise.resolve([makeFeed()]));
    feedRepo.findById.mockReturnValue(Promise.resolve(makeFeed()));
    mockFetchFeed.mockImplementation(() => Promise.reject(new Error("Network error")));

    const result = await service.syncAll();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("My Feed");
    expect(result.errors[0]).toContain("1/3");
  });

  it("syncAll auto-disables feed after 3 consecutive failures", async () => {
    feedRepo.findActive.mockReturnValue(Promise.resolve([makeFeed()]));
    feedRepo.findById.mockReturnValue(Promise.resolve(makeFeed()));
    feedRepo.update.mockReturnValue(Promise.resolve(makeFeed({ syncEnabled: false })));
    mockFetchFeed.mockImplementation(() => Promise.reject(new Error("404")));

    // Fail 3 times
    await service.syncAll(); // 1/3
    await service.syncAll(); // 2/3
    const result = await service.syncAll(); // 3/3 → disabled

    expect(feedRepo.update).toHaveBeenCalledWith("f-1", { syncEnabled: false });
    expect(result.errors[0]).toContain("desactive");
  });

  it("syncAll resets failure counter on success", async () => {
    feedRepo.findActive.mockReturnValue(Promise.resolve([makeFeed()]));
    feedRepo.findById.mockReturnValue(Promise.resolve(makeFeed()));
    mockFetchFeed.mockImplementation(() => Promise.reject(new Error("fail")));

    await service.syncAll(); // 1/3
    await service.syncAll(); // 2/3

    // Now succeed
    mockFetchFeed.mockImplementation(() => Promise.resolve({ siteUrl: null, items: [] }));
    articleRepo.bulkCreate.mockReturnValue(Promise.resolve(0));
    await service.syncAll(); // success → counter reset

    // Fail again — should be 1/3, not 4/3
    mockFetchFeed.mockImplementation(() => Promise.reject(new Error("fail again")));
    const result = await service.syncAll();
    expect(result.errors[0]).toContain("1/3");
    expect(feedRepo.update).not.toHaveBeenCalledWith("f-1", { syncEnabled: false });
  });

  it("syncAll returns zero when no active feeds", async () => {
    const result = await service.syncAll();
    expect(result.total).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  // --- Cleanup ---
  it("cleanupOldArticles deletes old non-starred articles", async () => {
    articleRepo.deleteOlderThan.mockReturnValue(Promise.resolve(15));

    const deleted = await service.cleanupOldArticles(90);

    expect(deleted).toBe(15);
    expect(articleRepo.deleteOlderThan).toHaveBeenCalledTimes(1);
    // Verify the date is roughly 90 days ago
    const calledDate = (articleRepo.deleteOlderThan as any).mock.calls[0][0] as Date;
    const daysDiff = (Date.now() - calledDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeGreaterThan(89);
    expect(daysDiff).toBeLessThan(91);
  });

  it("cleanupOldArticles returns 0 when nothing to delete", async () => {
    articleRepo.deleteOlderThan.mockReturnValue(Promise.resolve(0));

    const deleted = await service.cleanupOldArticles(30);
    expect(deleted).toBe(0);
  });

  // --- Full content ---
  it("fetchFullContent returns null when article not found", async () => {
    const result = await service.fetchFullContent("nonexistent");
    expect(result).toBeNull();
  });

  it("fetchFullContent returns cached content if already long enough", async () => {
    const longContent = "<p>Already fetched</p>".repeat(50);
    articleRepo.findById.mockReturnValue(Promise.resolve(makeArticle({ content: longContent })));

    const result = await service.fetchFullContent("a-1");
    expect(result!.content).toBe(longContent);
    expect(mockExtractContent).not.toHaveBeenCalled();
  });

  it("fetchFullContent extracts and caches content from URL", async () => {
    const article = makeArticle({ content: null, link: "https://example.com/post" });
    articleRepo.findById.mockReturnValue(Promise.resolve(article));
    const updated = makeArticle({ content: "<p>Full content</p>".repeat(50) });
    articleRepo.updateContent.mockReturnValue(Promise.resolve(updated));

    const result = await service.fetchFullContent("a-1");
    expect(mockExtractContent).toHaveBeenCalledWith("https://example.com/post");
    expect(articleRepo.updateContent).toHaveBeenCalledTimes(1);
    expect(result!.content!.length).toBeGreaterThan(500);
  });

  it("fetchFullContent returns original article when link is null", async () => {
    const article = makeArticle({ content: null, link: null });
    articleRepo.findById.mockReturnValue(Promise.resolve(article));

    const result = await service.fetchFullContent("a-1");
    expect(result).toEqual(article);
    expect(mockExtractContent).not.toHaveBeenCalled();
  });

  it("fetchFullContent returns original article on extraction error", async () => {
    const article = makeArticle({ content: null, link: "https://example.com/post" });
    articleRepo.findById.mockReturnValue(Promise.resolve(article));
    mockExtractContent.mockImplementation(() => Promise.reject(new Error("Failed")));

    const result = await service.fetchFullContent("a-1");
    expect(result).toEqual(article);
  });
});
