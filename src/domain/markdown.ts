import { Cluster, EnrichedCluster } from "./model.js";

function clusterLine(cluster: Cluster, enriched?: EnrichedCluster): string {
  const links = cluster.items
    .slice(0, 2)
    .map((i) => `<${i.url}|${i.source}>`)
    .join(" / ");

  const summary = enriched?.summaryJa ?? "要約生成に失敗したため、元リンクを確認してください。";
  const tags = (enriched?.tags ?? ["Trend"]).slice(0, 3).map((t) => `#${t}`).join(" ");
  const reason = enriched?.reasonToRead ?? `増分スコア:+${cluster.deltaScore} / コメント:+${cluster.deltaComments}`;

  return [
    `• *${cluster.title}*`,
    `  ${summary}`,
    `  ${tags}`,
    `  理由: ${reason}`,
    `  link: ${links}`
  ].join("\n");
}

function section(title: string, clusters: Cluster[], enrichedMap: Map<string, EnrichedCluster>): string {
  const lines = clusters.map((c) => clusterLine(c, enrichedMap.get(c.id))).join("\n\n");
  return `*${title}*\n${lines || "(なし)"}`;
}

export function renderMarkdown(input: {
  jstDate: string;
  topTopics: Cluster[];
  rising: Cluster[];
  deepDiscussion: Cluster[];
  enriched: EnrichedCluster[];
}): string {
  const enrichedMap = new Map(input.enriched.map((x) => [x.clusterId, x]));
  return [
    `*今日のエンジニアトレンド（${input.jstDate} JST）*`,
    section("🧩 注目トピック Top 7", input.topTopics, enrichedMap),
    section("🔥 急上昇 Top 5", input.rising, enrichedMap),
    section("🧵 議論が深い Top 5", input.deepDiscussion, enrichedMap)
  ].join("\n\n");
}
