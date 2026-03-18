import Parser from "rss-parser";

export interface ParsedFeedItem {
  guid: string;
  title: string | null;
  link: string | null;
  description: string | null;
  content: string | null;
  author: string | null;
  publishedAt: Date | null;
}

export interface ParsedFeed {
  siteUrl: string | null;
  items: ParsedFeedItem[];
}

const parser = new Parser({
  customFields: {
    item: [["content:encoded", "contentEncoded"]],
  },
});

export async function fetchFeed(url: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(url);

  const items: ParsedFeedItem[] = (feed.items || []).map((item: any) => ({
    guid: item.guid || item.id || item.link || "",
    title: item.title || null,
    link: item.link || null,
    description: item.contentSnippet || item.summary || null,
    content: item.contentEncoded || item.content || null,
    author: item.creator || item.author || null,
    publishedAt: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null,
  }));

  return {
    siteUrl: feed.link || null,
    items,
  };
}
