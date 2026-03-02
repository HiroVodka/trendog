import { Cluster, EnrichedCluster } from "./model.js";

function clusterLine(cluster: Cluster, enriched?: EnrichedCluster, index?: number): string {
  const summary = enriched?.summaryJa ?? "要約生成に失敗したため、元リンクを確認してください。";
  const reason = enriched?.reasonToRead ?? "対象読者の実務に関連する可能性が高いため。";
  const url = cluster.canonicalUrl || cluster.items[0]?.url || "";

  return [
    `${index != null ? `${index + 1}. ` : ""}*${cluster.title}*`,
    `URL: ${url}`,
    `要約: ${summary}`,
    `おすすめ理由: ${reason}`
  ].join("\n");
}

export function renderMarkdown(input: {
  jstDate: string;
  audienceProfile: string;
  clusters: Cluster[];
  enriched: EnrichedCluster[];
}): string {
  const enrichedMap = new Map(input.enriched.map((x) => [x.clusterId, x]));
  const lines = input.clusters.map((c, i) => clusterLine(c, enrichedMap.get(c.id), i)).join("\n\n");
  return [
    `*今日のエンジニアトレンド（${input.jstDate} JST）*`,
    `*対象読者:* ${input.audienceProfile}`,
    lines || "(該当なし)"
  ].join("\n\n");
}
