import { SourceItem } from "../../domain/model.js";
import { SourceFetcher } from "../../ports/sourceFetcher.js";
import { fetchJsonWithRetry } from "../../shared/http.js";

interface HNItem {
  id: number;
  title: string;
  url?: string;
  score?: number;
  descendants?: number;
  time?: number;
}

export class HackerNewsFetcher implements SourceFetcher {
  readonly name = "hackernews";

  async fetchItems(): Promise<SourceItem[]> {
    const ids = await fetchJsonWithRetry<number[]>("https://hacker-news.firebaseio.com/v0/topstories.json");
    const head = ids.slice(0, 50);
    const items = await Promise.all(
      head.map((id) => fetchJsonWithRetry<HNItem>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`))
    );

    return items
      .filter((x) => !!x?.title)
      .map((x) => ({
        source: "hackernews",
        id: String(x.id),
        title: x.title,
        url: x.url ?? `https://news.ycombinator.com/item?id=${x.id}`,
        score: x.score ?? 0,
        comments: x.descendants ?? 0,
        publishedAt: x.time ? new Date(x.time * 1000).toISOString() : new Date().toISOString()
      }));
  }
}
