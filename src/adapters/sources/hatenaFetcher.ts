import { SourceItem } from "../../domain/model.js";
import { SourceFetcher } from "../../ports/sourceFetcher.js";
import { withRetry } from "../../shared/retry.js";

export class HatenaFetcher implements SourceFetcher {
  readonly name = "hatena";

  async fetchItems(): Promise<SourceItem[]> {
    const url = "https://b.hatena.ne.jp/hotentry/it.rss";
    const xml = await withRetry(
      async () => {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        return res.text();
      },
      2,
      500
    );
    const entries = parseHatenaRss(xml);

    return entries.slice(0, 60).map((x, i) => ({
      source: "hatena",
      id: String(i + 1),
      title: x.title,
      url: x.link,
      score: x.bookmarks,
      comments: 0,
      publishedAt: x.date,
      contentSnippet: x.description
    }));
  }
}

function parseHatenaRss(
  xml: string
): Array<{ title: string; link: string; bookmarks: number; date: string; description: string }> {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((item) => {
      const title = decodeXml(matchTag(item, "title") ?? "");
      const link = decodeXml(matchTag(item, "link") ?? "");
      const description = sanitizeText(decodeXml(matchTag(item, "description") ?? ""));
      const date = matchTag(item, "dc:date") ?? new Date().toISOString();
      const bookmarkRaw = matchTag(item, "hatena:bookmarkcount") ?? "0";
      const bookmarks = Number(bookmarkRaw) || 0;
      return { title, link, date, bookmarks, description };
    })
    .filter((x) => x.title.length > 0 && x.link.length > 0);
}

function matchTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m?.[1]?.trim();
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, num: string) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function sanitizeText(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);
}
