import { SourceItem } from "../../domain/model.js";
import { SourceFetcher } from "../../ports/sourceFetcher.js";
import { fetchJsonWithRetry } from "../../shared/http.js";

interface HatenaEntry {
  title: string;
  link: string;
  bookmarks?: number;
  date?: string;
}

export class HatenaFetcher implements SourceFetcher {
  readonly name = "hatena";

  async fetchItems(): Promise<SourceItem[]> {
    const url = "https://b.hatena.ne.jp/hotentry/it.json";
    const data = await fetchJsonWithRetry<HatenaEntry[] | { items?: HatenaEntry[] }>(url);
    const list = Array.isArray(data) ? data : (data.items ?? []);

    return list.slice(0, 60).map((x, i) => ({
      source: "hatena",
      id: String(i + 1),
      title: x.title,
      url: x.link,
      score: x.bookmarks ?? 0,
      comments: 0,
      publishedAt: x.date ?? new Date().toISOString()
    }));
  }
}
