import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";

export interface RssFeed {
  id: string;
  label: string;
  url: string;
  category: string | null;
  siteUrl: string | null;
  lastSyncedAt: string | null;
  syncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RssArticle {
  id: string;
  feedId: string;
  guid: string;
  title: string | null;
  link: string | null;
  description: string | null;
  content: string | null;
  author: string | null;
  publishedAt: string | null;
  isRead: boolean;
  isStarred: boolean;
  createdAt: string;
}

export interface FetchArticlesOptions {
  feedId?: string;
  unread?: boolean;
  starred?: boolean;
  limit?: number;
  offset?: number;
}

const [feeds, setFeeds] = createSignal<RssFeed[]>([]);
const [articles, setArticles] = createSignal<RssArticle[]>([]);
const [selectedArticle, setSelectedArticle] = createSignal<RssArticle | null>(null);
const [activeFeedId, setActiveFeedId] = createSignal<string | null>(null);
const [isLoading, setIsLoading] = createSignal(false);
const [unreadCount, setUnreadCount] = createSignal(0);

export function useRssStore() {
  async function fetchFeeds() {
    try {
      const data = await api.get<RssFeed[]>("/rss-feeds");
      setFeeds(data);
    } catch (e) {
      console.error("Failed to fetch RSS feeds:", e);
    }
  }

  async function fetchArticles(options?: FetchArticlesOptions) {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (options?.feedId) params.set("feedId", options.feedId);
      if (options?.unread !== undefined) params.set("unread", String(options.unread));
      if (options?.starred !== undefined) params.set("starred", String(options.starred));
      params.set("limit", String(options?.limit ?? 50));
      params.set("offset", String(options?.offset ?? 0));
      const qs = params.toString();
      const data = await api.get<RssArticle[]>(`/rss-articles?${qs}`);
      setArticles(data);
    } catch (e) {
      console.error("Failed to fetch RSS articles:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function selectArticle(article: RssArticle | null) {
    setSelectedArticle(article);
    if (article && !article.isRead) {
      try {
        await api.patch<RssArticle>(`/rss-articles/${article.id}`, { isRead: true });
        setArticles((prev) =>
          prev.map((a) => (a.id === article.id ? { ...a, isRead: true } : a))
        );
        setSelectedArticle({ ...article, isRead: true });
        await fetchUnreadCount();
      } catch (e) {
        console.error("Failed to mark article as read:", e);
      }
    }
  }

  async function toggleStar(articleId: string) {
    const article = articles().find((a) => a.id === articleId);
    if (!article) return;
    try {
      await api.patch<RssArticle>(`/rss-articles/${articleId}`, { isStarred: !article.isStarred });
      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, isStarred: !a.isStarred } : a))
      );
      if (selectedArticle()?.id === articleId) {
        setSelectedArticle({ ...article, isStarred: !article.isStarred });
      }
    } catch (e) {
      console.error("Failed to toggle star:", e);
    }
  }

  async function markAllRead() {
    try {
      const feedId = activeFeedId();
      await api.post("/rss-articles/mark-all-read", { feedId: feedId ?? undefined });
      setArticles((prev) => prev.map((a) => ({ ...a, isRead: true })));
      await fetchUnreadCount();
    } catch (e) {
      console.error("Failed to mark all as read:", e);
    }
  }

  async function syncAll() {
    try {
      setIsLoading(true);
      for (const feed of feeds()) {
        if (feed.syncEnabled) {
          await api.post(`/rss-feeds/${feed.id}/sync`, {});
        }
      }
      await fetchArticles({ feedId: activeFeedId() ?? undefined });
      await fetchUnreadCount();
    } catch (e) {
      console.error("Failed to sync RSS feeds:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function addFeed(input: { url: string; label: string; category?: string | null }) {
    try {
      const feed = await api.post<RssFeed>("/rss-feeds", input);
      setFeeds((prev) => [...prev, feed]);
      return feed;
    } catch (e) {
      console.error("Failed to add RSS feed:", e);
    }
  }

  async function updateFeed(id: string, input: { label?: string; category?: string | null; syncEnabled?: boolean }) {
    try {
      const feed = await api.put<RssFeed>(`/rss-feeds/${id}`, input);
      setFeeds((prev) => prev.map((f) => (f.id === id ? feed : f)));
      return feed;
    } catch (e) {
      console.error("Failed to update RSS feed:", e);
    }
  }

  async function removeFeed(id: string) {
    try {
      await api.delete(`/rss-feeds/${id}`);
      setFeeds((prev) => prev.filter((f) => f.id !== id));
      if (activeFeedId() === id) {
        setActiveFeedId(null);
        await fetchArticles();
      }
    } catch (e) {
      console.error("Failed to remove RSS feed:", e);
    }
  }

  async function fetchUnreadCount() {
    try {
      const data = await api.get<{ count: number }>("/rss-articles/unread-count");
      setUnreadCount(data.count);
    } catch (e) {
      console.error("Failed to fetch unread count:", e);
    }
  }

  return {
    feeds,
    articles,
    selectedArticle,
    activeFeedId,
    setActiveFeedId,
    isLoading,
    unreadCount,
    fetchFeeds,
    fetchArticles,
    selectArticle,
    toggleStar,
    markAllRead,
    syncAll,
    addFeed,
    updateFeed,
    removeFeed,
    fetchUnreadCount,
  };
}
