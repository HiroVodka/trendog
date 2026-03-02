import { SourceItem } from "../../domain/model.js";
import { SourceFetcher } from "../../ports/sourceFetcher.js";
import { fetchJsonWithRetry } from "../../shared/http.js";

interface HNItem {
  id: number;
  title: string;
  url?: string;
  text?: string;
  score?: number;
  descendants?: number;
  time?: number;
}

export class HackerNewsFetcher implements SourceFetcher {
  readonly name = "hackernews";

  async fetchItems(): Promise<SourceItem[]> {
    const [askIds, showIds, topIds] = await Promise.all([
      fetchJsonWithRetry<number[]>("https://hacker-news.firebaseio.com/v0/askstories.json"),
      fetchJsonWithRetry<number[]>("https://hacker-news.firebaseio.com/v0/showstories.json"),
      fetchJsonWithRetry<number[]>("https://hacker-news.firebaseio.com/v0/topstories.json")
    ]);
    const prioritizedIds = uniqueIds([...askIds.slice(0, 80), ...showIds.slice(0, 80), ...topIds.slice(0, 40)]);
    const head = prioritizedIds.slice(0, 120);
    const items = await Promise.all(
      head.map((id) => fetchJsonWithRetry<HNItem>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`))
    );

    const mapped: SourceItem[] = items
      .filter((x) => !!x?.title)
      .map((x) => ({
        source: "hackernews" as const,
        id: String(x.id),
        title: x.title,
        url: x.url ?? `https://news.ycombinator.com/item?id=${x.id}`,
        score: x.score ?? 0,
        comments: x.descendants ?? 0,
        publishedAt: x.time ? new Date(x.time * 1000).toISOString() : new Date().toISOString(),
        contentSnippet: sanitizeText(x.text ?? "")
      }));
    return mapped.slice(0, 80);
  }
}

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

function sanitizeText(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);
}
