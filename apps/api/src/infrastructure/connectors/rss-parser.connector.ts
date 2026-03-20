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

/** Sanitize common XML issues (unescaped &, etc.) before parsing */
function sanitizeXml(xml: string): string {
  // Replace bare & that are not already part of an entity (e.g. &amp; &lt; &#123;)
  return xml.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
}

export async function fetchFeed(url: string): Promise<ParsedFeed> {
  // Fetch raw XML with timeout (rss-parser's parseURL uses Node http without timeout)
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Status code ${res.status}`);
  let raw = await res.text();

  let feed;
  try {
    feed = await parser.parseString(raw);
  } catch (err) {
    // If XML parsing fails, try with sanitized XML (unescaped & etc.)
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Invalid character") || msg.includes("not well-formed")) {
      feed = await parser.parseString(sanitizeXml(raw));
    } else {
      throw err;
    }
  }

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
