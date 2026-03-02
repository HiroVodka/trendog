import { Cluster, ScoredItem, SourceItem } from "./model.js";
import { ageHours } from "../shared/time.js";

function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    if (u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return url;
  }
}

export function scoreItems(
  items: SourceItem[],
  now: Date
): ScoredItem[] {
  return items.map((item) => {
    const h = ageHours(now, item.publishedAt);
    const freshness = Math.exp(-h / 24);
    const rankScore = (item.score + 0.5 * item.comments) * freshness;

    return {
      ...item,
      ageHours: h,
      rankScore
    };
  });
}

export function clusterByUrl(scoredItems: ScoredItem[]): Cluster[] {
  const map = new Map<string, Cluster>();
  for (const item of scoredItems) {
    const url = canonicalizeUrl(item.url || item.rawUrl || `${item.source}:${item.id}`);
    const existing = map.get(url);
    if (existing) {
      existing.items.push(item);
      existing.rankScore += item.rankScore;
      if (item.rankScore > existing.items[0].rankScore) {
        existing.title = item.title;
      }
      continue;
    }

    map.set(url, {
      id: `cluster_${map.size + 1}`,
      canonicalUrl: url,
      title: item.title,
      items: [item],
      rankScore: item.rankScore
    });
  }

  return [...map.values()].sort((a, b) => b.rankScore - a.rankScore);
}
