package domain

type SourceName string

const (
	SourceHatena     SourceName = "hatena"
	SourceHackerNews SourceName = "hackernews"
	SourceZenn       SourceName = "zenn"
)

type SourceItem struct {
	Source         SourceName `json:"source"`
	ID             string     `json:"id"`
	Title          string     `json:"title"`
	URL            string     `json:"url"`
	Score          float64    `json:"score"`
	Comments       float64    `json:"comments"`
	PublishedAt    string     `json:"publishedAt"`
	ContentSnippet string     `json:"contentSnippet,omitempty"`
}

type ItemState struct {
	Score    float64 `json:"score"`
	Comments float64 `json:"comments"`
	LastSeen string  `json:"lastSeen"`
}

type AppState struct {
	LastRunJSTDate string               `json:"lastRunJstDate,omitempty"`
	ItemsState     map[string]ItemState `json:"itemsState"`
	PostedHashes   map[string]string    `json:"postedHashes"`
}

type ScoredItem struct {
	SourceItem
	AgeHours  float64 `json:"ageHours"`
	RankScore float64 `json:"rankScore"`
}

type Cluster struct {
	ID           string       `json:"id"`
	CanonicalURL string       `json:"canonicalUrl"`
	Title        string       `json:"title"`
	Items        []ScoredItem `json:"items"`
	RankScore    float64      `json:"rankScore"`
}

type EnrichedCluster struct {
	ClusterID    string   `json:"clusterId"`
	IsImportant  bool     `json:"isImportant"`
	SummaryJA    string   `json:"summaryJa"`
	Tags         []string `json:"tags"`
	ReasonToRead string   `json:"reasonToRead"`
}

const (
	DefaultMaxTopics = 17
	MaxTopicsLimit   = 30
	AnchorJSTDate    = "2026-03-02"
)

var TagCandidates = []string{
	"AI", "Web", "Backend", "Frontend", "Infra", "DevOps", "Security", "Cloud", "Data", "Mobile", "Tooling", "Architecture", "Testing", "Performance",
}
