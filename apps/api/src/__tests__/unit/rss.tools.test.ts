import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createRssTools } from "../../application/agent/tools/rss.tools";
import type { RssService } from "../../application/rss/rss.service";
import type { RssFeed, RssArticle } from "../../domain/rss/rss.entity";
import type { AgentTool } from "../../application/agent/tool-registry";

const makeFeed = (overrides: Partial<RssFeed> = {}): RssFeed => ({
  id: "feed-1",
  label: "Hacker News",
  url: "https://news.ycombinator.com/rss",
  category: "Tech",
  siteUrl: "https://news.ycombinator.com",
  lastSyncedAt: null,
  syncEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeArticle = (overrides: Partial<RssArticle> = {}): RssArticle => ({
  id: "art-1",
  feedId: "feed-1",
  guid: "guid-1",
  title: "Title",
  link: "https://example.com/a",
  description: null,
  content: null,
  author: null,
  publishedAt: new Date(),
  isRead: false,
  isStarred: false,
  createdAt: new Date(),
  ...overrides,
});

describe("rss.tools", () => {
  let svc: { [K in keyof RssService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let addFeed: AgentTool;
  let removeFeed: AgentTool;
  let star: AgentTool;
  let markRead: AgentTool;
  let markAllRead: AgentTool;
  let digest: AgentTool;

  beforeEach(() => {
    svc = {
      getFeeds: mock(() => Promise.resolve([])),
      getFeedById: mock(() => Promise.resolve(null)),
      createFeed: mock(() => Promise.resolve(makeFeed())),
      updateFeed: mock(() => Promise.resolve(makeFeed())),
      deleteFeed: mock(() => Promise.resolve(true)),
      getArticles: mock(() => Promise.resolve([])),
      getArticleById: mock(() => Promise.resolve(null)),
      updateArticleFlags: mock(() => Promise.resolve(makeArticle())),
      deleteArticle: mock(() => Promise.resolve(true)),
      getUnreadCount: mock(() => Promise.resolve(0)),
      getUnreadCountPerFeed: mock(() => Promise.resolve({})),
      markAllRead: mock(() => Promise.resolve(0)),
      fetchFullContent: mock(() => Promise.resolve(null)),
      syncFeed: mock(() => Promise.resolve({ newArticles: 0 })),
      cleanupOldArticles: mock(() => Promise.resolve(0)),
      syncAll: mock(() => Promise.resolve({ total: 0, errors: [] })),
      generateDigest: mock(() => Promise.resolve({} as never)),
      setLlmService: mock(() => undefined),
    } as unknown as { [K in keyof RssService]: ReturnType<typeof mock> };

    tools = createRssTools(svc as unknown as RssService);
    addFeed = tools.find((t) => t.name === "rss_add_feed")!;
    removeFeed = tools.find((t) => t.name === "rss_remove_feed")!;
    star = tools.find((t) => t.name === "rss_star")!;
    markRead = tools.find((t) => t.name === "rss_mark_read")!;
    markAllRead = tools.find((t) => t.name === "rss_mark_all_read")!;
    digest = tools.find((t) => t.name === "rss_generate_digest")!;
  });

  it("registers the 6 P4.3 RSS tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "rss_add_feed",
      "rss_generate_digest",
      "rss_mark_all_read",
      "rss_mark_read",
      "rss_remove_feed",
      "rss_star",
    ]);
  });

  it("only rss_remove_feed is user-confirm", () => {
    expect(removeFeed.permissionLevel).toBe("user-confirm");
    expect(addFeed.permissionLevel).toBe("auto");
    expect(star.permissionLevel).toBe("auto");
    expect(markRead.permissionLevel).toBe("auto");
    expect(markAllRead.permissionLevel).toBe("auto");
    expect(digest.permissionLevel).toBe("auto");
  });

  describe("rss_add_feed", () => {
    it("forwards label, url, category", async () => {
      const feed = makeFeed({ label: "HN" });
      svc.createFeed.mockReturnValue(Promise.resolve(feed));
      const result = (await addFeed.execute({
        label: "HN",
        url: "https://news.ycombinator.com/rss",
        category: "Tech",
      })) as { added: boolean; feed: RssFeed };
      expect(result.added).toBe(true);
      expect(result.feed.label).toBe("HN");
      expect(svc.createFeed).toHaveBeenCalledWith({
        label: "HN",
        url: "https://news.ycombinator.com/rss",
        category: "Tech",
      });
    });

    it("rejects a non-http URL via zod", async () => {
      const result = (await addFeed.execute({ label: "X", url: "ftp://x.com" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.createFeed).not.toHaveBeenCalled();
    });

    it("wraps a service throw as { error }", async () => {
      svc.createFeed.mockReturnValue(Promise.reject(new Error("Duplicate URL")));
      const result = (await addFeed.execute({ label: "X", url: "https://x.com/rss" })) as { error?: string };
      expect(result.error).toBe("Duplicate URL");
    });
  });

  describe("rss_remove_feed", () => {
    it("delegates and returns deleted=true", async () => {
      svc.deleteFeed.mockReturnValue(Promise.resolve(true));
      const result = (await removeFeed.execute({ feedId: "feed-1" })) as { deleted: boolean };
      expect(result.deleted).toBe(true);
      expect(svc.deleteFeed).toHaveBeenCalledWith("feed-1");
    });

    it("returns a not-found error when service returns false", async () => {
      svc.deleteFeed.mockReturnValue(Promise.resolve(false));
      const result = (await removeFeed.execute({ feedId: "ghost" })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });
  });

  describe("rss_star", () => {
    it("defaults to isStarred=true", async () => {
      svc.updateArticleFlags.mockReturnValue(Promise.resolve(makeArticle({ isStarred: true })));
      await star.execute({ articleId: "art-1" });
      expect(svc.updateArticleFlags).toHaveBeenCalledWith("art-1", { isStarred: true });
    });

    it("forwards isStarred=false", async () => {
      svc.updateArticleFlags.mockReturnValue(Promise.resolve(makeArticle({ isStarred: false })));
      const result = (await star.execute({ articleId: "art-1", isStarred: false })) as { isStarred: boolean };
      expect(result.isStarred).toBe(false);
    });

    it("returns a not-found error when service returns null", async () => {
      svc.updateArticleFlags.mockReturnValue(Promise.resolve(null));
      const result = (await star.execute({ articleId: "ghost" })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });
  });

  describe("rss_mark_read", () => {
    it("defaults to isRead=true", async () => {
      svc.updateArticleFlags.mockReturnValue(Promise.resolve(makeArticle({ isRead: true })));
      await markRead.execute({ articleId: "art-1" });
      expect(svc.updateArticleFlags).toHaveBeenCalledWith("art-1", { isRead: true });
    });

    it("forwards isRead=false (unread)", async () => {
      svc.updateArticleFlags.mockReturnValue(Promise.resolve(makeArticle({ isRead: false })));
      const result = (await markRead.execute({ articleId: "art-1", isRead: false })) as { isRead: boolean };
      expect(result.isRead).toBe(false);
    });
  });

  describe("rss_mark_all_read", () => {
    it("delegates to service.markAllRead and returns the count", async () => {
      svc.markAllRead.mockReturnValue(Promise.resolve(17));
      const result = (await markAllRead.execute({ feedId: "feed-1" })) as { markedRead: number };
      expect(result.markedRead).toBe(17);
      expect(svc.markAllRead).toHaveBeenCalledWith("feed-1");
    });

    it("rejects empty feedId", async () => {
      const result = (await markAllRead.execute({ feedId: "" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.markAllRead).not.toHaveBeenCalled();
    });
  });

  describe("rss_generate_digest", () => {
    it("delegates to service.generateDigest", async () => {
      svc.generateDigest.mockReturnValue(Promise.resolve({ totalUnread: 3, summary: "ok" } as never));
      const result = (await digest.execute({})) as { totalUnread: number; summary: string };
      expect(result.totalUnread).toBe(3);
      expect(svc.generateDigest).toHaveBeenCalledTimes(1);
    });

    it("wraps a 'LLM service not configured' throw as { error }", async () => {
      svc.generateDigest.mockReturnValue(Promise.reject(new Error("LLM service not configured")));
      const result = (await digest.execute({})) as { error?: string };
      expect(result.error).toBe("LLM service not configured");
    });
  });
});
