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
  prevState: Record<string, { score: number; comments: number }>,
  now: Date
): ScoredItem[] {
  return items.map((item) => {
    const key = `${item.source}:${item.id}`;
    const prev = prevState[key];
    const deltaScore = Math.max(0, item.score - (prev?.score ?? 0));
    const deltaComments = Math.max(0, item.comments - (prev?.comments ?? 0));
    const h = ageHours(now, item.publishedAt);
    const freshness = Math.exp(-h / 18);
    const trendScore =
      (Math.log1p(deltaScore) + 0.7 * Math.log1p(deltaComments) + 0.2 * Math.log1p(Math.max(0, item.score))) * freshness;

    return {
      ...item,
      ageHours: h,
      deltaScore,
      deltaComments,
      trendScore
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
      existing.deltaScore += item.deltaScore;
      existing.deltaComments += item.deltaComments;
      existing.trendScore += item.trendScore;
      if (item.trendScore > existing.items[0].trendScore) {
        existing.title = item.title;
      }
      continue;
    }

    map.set(url, {
      id: `cluster_${map.size + 1}`,
      canonicalUrl: url,
      title: item.title,
      items: [item],
      deltaScore: item.deltaScore,
      deltaComments: item.deltaComments,
      trendScore: item.trendScore
    });
  }

  return [...map.values()].sort((a, b) => b.trendScore - a.trendScore);
}

export function pickSections(clusters: Cluster[], maxTopics: number): {
  selected: Cluster[];
  topTopics: Cluster[];
  rising: Cluster[];
  deepDiscussion: Cluster[];
} {
  const selected = clusters.slice(0, maxTopics);
  const topTopics = [...selected].sort((a, b) => b.trendScore - a.trendScore).slice(0, 7);
  const rising = [...selected]
    .sort((a, b) => b.deltaScore - a.deltaScore || b.trendScore - a.trendScore)
    .slice(0, 5);
  const deepDiscussion = [...selected]
    .sort((a, b) => b.deltaComments - a.deltaComments || b.trendScore - a.trendScore)
    .slice(0, 5);

  return { selected, topTopics, rising, deepDiscussion };
}
