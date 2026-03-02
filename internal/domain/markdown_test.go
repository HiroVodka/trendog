package domain

import "testing"

func TestRenderMarkdown(t *testing.T) {
	c := Cluster{
		ID:           "cluster_1",
		CanonicalURL: "https://example.com/a",
		Title:        "Topic A",
		RankScore:    1,
		Items:        []ScoredItem{{SourceItem: SourceItem{Source: SourceHackerNews, ID: "1", Title: "Topic A", URL: "https://example.com/a"}, RankScore: 1}},
	}
	md := RenderMarkdown("2026-03-02", "バックエンドエンジニア", []Cluster{c}, []EnrichedCluster{{ClusterID: "cluster_1", IsImportant: true, SummaryJA: "要約", ReasonToRead: "理由"}})
	if md == "" || !contains(md, "Topic A") || !contains(md, "URL: https://example.com/a") || !contains(md, "要約") {
		t.Fatalf("unexpected markdown: %s", md)
	}
}

func contains(s, sub string) bool { return len(s) >= len(sub) && (indexOf(s, sub) >= 0) }

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
