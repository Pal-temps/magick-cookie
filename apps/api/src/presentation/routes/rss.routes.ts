import { Hono } from "hono";
import type { RssService } from "../../application/rss/rss.service";
import { getLastRssDigest, setLastRssDigest } from "../../infrastructure/jobs/rss-sync.job";
import {
  createRssFeedSchema,
  updateRssFeedSchema,
  updateArticleFlagsSchema,
  articleQuerySchema,
} from "../validators/rss.validator";

export function createRssFeedRoutes(service: RssService) {
  const app = new Hono();

  // GET /api/rss-feeds
  app.get("/", async (c) => {
    const data = await service.getFeeds();
    return c.json({ data });
  });

  // GET /api/rss-feeds/:id
  app.get("/:id", async (c) => {
    const feed = await service.getFeedById(c.req.param("id"));
    if (!feed) return c.json({ error: "Feed not found" }, 404);
    return c.json({ data: feed });
  });

  // POST /api/rss-feeds
  app.post("/", async (c) => {
    const input = createRssFeedSchema.parse(await c.req.json());
    const data = await service.createFeed(input);
    return c.json({ data }, 201);
  });

  // PUT /api/rss-feeds/:id
  app.put("/:id", async (c) => {
    const input = updateRssFeedSchema.parse(await c.req.json());
    const data = await service.updateFeed(c.req.param("id"), input);
    if (!data) return c.json({ error: "Feed not found" }, 404);
    return c.json({ data });
  });

  // DELETE /api/rss-feeds/:id
  app.delete("/:id", async (c) => {
    const deleted = await service.deleteFeed(c.req.param("id"));
    if (!deleted) return c.json({ error: "Feed not found" }, 404);
    return c.json({ data: { ok: true } });
  });

  // POST /api/rss-feeds/:id/sync
  app.post("/:id/sync", async (c) => {
    const result = await service.syncFeed(c.req.param("id"));
    return c.json({ data: result });
  });

  // POST /api/rss-feeds/sync-all
  app.post("/sync-all", async (c) => {
    const result = await service.syncAll();
    return c.json({ data: result });
  });

  // POST /api/rss-feeds/cleanup — delete old articles
  app.post("/cleanup", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const retentionDays = Number(body.retentionDays) || 90;
    const deleted = await service.cleanupOldArticles(retentionDays);
    return c.json({ data: { deleted, retentionDays } });
  });

  return app;
}

export function createRssArticleRoutes(service: RssService) {
  const app = new Hono();

  // GET /api/rss-articles
  app.get("/", async (c) => {
    const query = articleQuerySchema.parse(c.req.query());
    const data = await service.getArticles(query);
    return c.json({ data });
  });

  // GET /api/rss-articles/unread-count
  app.get("/unread-count", async (c) => {
    const feedId = c.req.query("feedId");
    const count = await service.getUnreadCount(feedId);
    return c.json({ data: { count } });
  });

  // GET /api/rss-articles/unread-counts — per-feed unread counts
  app.get("/unread-counts", async (c) => {
    const counts = await service.getUnreadCountPerFeed();
    return c.json({ data: counts });
  });

  // GET /api/rss-articles/digest — return cached daily digest
  app.get("/digest", async (c) => {
    const cached = getLastRssDigest();
    if (cached) return c.json({ data: cached.data });
    return c.json({ data: null });
  });

  // POST /api/rss-articles/digest — force-generate a fresh AI digest
  app.post("/digest", async (c) => {
    const digest = await service.generateDigest();
    setLastRssDigest(digest);
    return c.json({ data: digest });
  });

  // POST /api/rss-articles/mark-all-read
  app.post("/mark-all-read", async (c) => {
    const { feedId } = await c.req.json();
    if (!feedId) return c.json({ error: "feedId is required" }, 400);
    const count = await service.markAllRead(feedId);
    return c.json({ data: { count } });
  });

  // GET /api/rss-articles/:id
  app.get("/:id", async (c) => {
    const article = await service.getArticleById(c.req.param("id"));
    if (!article) return c.json({ error: "Article not found" }, 404);
    return c.json({ data: article });
  });

  // GET /api/rss-articles/:id/full-content
  app.get("/:id/full-content", async (c) => {
    const article = await service.fetchFullContent(c.req.param("id"));
    if (!article) return c.json({ error: "Article not found" }, 404);
    return c.json({ data: article });
  });

  // PATCH /api/rss-articles/:id
  app.patch("/:id", async (c) => {
    const flags = updateArticleFlagsSchema.parse(await c.req.json());
    const article = await service.updateArticleFlags(c.req.param("id"), flags);
    if (!article) return c.json({ error: "Article not found" }, 404);
    return c.json({ data: article });
  });

  // DELETE /api/rss-articles/:id
  app.delete("/:id", async (c) => {
    const deleted = await service.deleteArticle(c.req.param("id"));
    if (!deleted) return c.json({ error: "Article not found" }, 404);
    return c.json({ data: { ok: true } });
  });

  return app;
}
