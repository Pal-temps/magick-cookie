import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface ExtractedContent {
  title: string | null;
  content: string;
  textContent: string;
  excerpt: string | null;
}

export async function extractArticleContent(url: string): Promise<ExtractedContent> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MagickCookie/1.0; RSS Reader)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status}`);
  }

  const html = await response.text();
  const { document } = parseHTML(html);

  const reader = new Readability(document as any);
  const article = reader.parse();

  if (!article) {
    throw new Error("Failed to extract article content (readability returned null)");
  }

  return {
    title: article.title || null,
    content: article.content,
    textContent: article.textContent,
    excerpt: article.excerpt || null,
  };
}
