import { SourceItem } from "../../domain/model.js";
import { SourceFetcher } from "../../ports/sourceFetcher.js";
import { withRetry } from "../../shared/retry.js";

export class ZennFetcher implements SourceFetcher {
  readonly name = "zenn";

  async fetchItems(): Promise<SourceItem[]> {
    const xml = await withRetry(
      async () => {
        const res = await fetch("https://zenn.dev/feed");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        return res.text();
      },
      2,
      500
    );

    const entries = parseZennRss(xml).slice(0, 60);
    return entries.map((entry, i) => ({
      source: "zenn",
      id: entry.id,
      title: entry.title,
      url: entry.link,
      comments: 0,
      // Zenn feed is already trend-ranked, so we map rank to score.
      score: Math.max(1, 100 - i),
      publishedAt: entry.pubDate
    }));
  }
}

function parseZennRss(xml: string): Array<{ id: string; title: string; link: string; pubDate: string }> {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((item) => {
      const title = decodeXml(stripCdata(matchTag(item, "title") ?? ""));
      const link = decodeXml(stripCdata(matchTag(item, "link") ?? ""));
      const guid = decodeXml(stripCdata(matchTag(item, "guid") ?? link));
      const pubDateRaw = stripCdata(matchTag(item, "pubDate") ?? "");
      const pubDate = pubDateRaw ? new Date(pubDateRaw).toISOString() : new Date().toISOString();
      return { id: guid || link, title, link, pubDate };
    })
    .filter((x) => x.id.length > 0 && x.title.length > 0 && x.link.length > 0);
}

function matchTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m?.[1]?.trim();
}

function stripCdata(text: string): string {
  const m = text.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i);
  return m?.[1] ?? text;
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, num: string) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
