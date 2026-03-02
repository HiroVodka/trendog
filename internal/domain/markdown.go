package domain

import (
	"fmt"
	"strings"
)

func RenderMarkdown(jstDate, audience string, clusters []Cluster, enriched []EnrichedCluster) string {
	em := map[string]EnrichedCluster{}
	for _, e := range enriched {
		em[e.ClusterID] = e
	}
	lines := []string{
		fmt.Sprintf("*今日のエンジニアトレンド（%s JST）*", jstDate),
		fmt.Sprintf("*対象読者:* %s", audience),
	}
	if len(clusters) == 0 {
		lines = append(lines, "(該当なし)")
		return strings.Join(lines, "\n\n")
	}
	for i, c := range clusters {
		e := em[c.ID]
		summary := e.SummaryJA
		if summary == "" {
			summary = "要約生成に失敗したため、元リンクを確認してください。"
		}
		reason := e.ReasonToRead
		if reason == "" {
			reason = "対象読者の実務に関連する可能性が高いため。"
		}
		url := c.CanonicalURL
		if url == "" && len(c.Items) > 0 {
			url = c.Items[0].URL
		}
		lines = append(lines,
			fmt.Sprintf("%d. *%s*\nURL: %s\n要約: %s\nおすすめ理由: %s", i+1, c.Title, url, summary, reason),
		)
	}
	return strings.Join(lines, "\n\n")
}
