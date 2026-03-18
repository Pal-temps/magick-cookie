export interface RssFeed {
  id: string;
  label: string;
  url: string;
  category: string | null;
  siteUrl: string | null;
  lastSyncedAt: Date | null;
  syncEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  publishedAt: Date | null;
  isRead: boolean;
  isStarred: boolean;
  createdAt: Date;
}

export interface CreateRssFeedInput {
  label: string;
  url: string;
  category?: string;
}

export interface UpdateRssFeedInput {
  label?: string;
  url?: string;
  category?: string;
  syncEnabled?: boolean;
}

export interface CreateRssArticleInput {
  feedId: string;
  guid: string;
  title: string | null;
  link: string | null;
  description: string | null;
  content: string | null;
  author: string | null;
  publishedAt: Date | null;
}
