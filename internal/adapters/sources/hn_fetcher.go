package sources

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/HiroVodka/trendog/internal/domain"
	"github.com/HiroVodka/trendog/internal/shared"
)

type HNFetcher struct{ client *http.Client }

func NewHNFetcher(client *http.Client) *HNFetcher {
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	return &HNFetcher{client: client}
}

func (f *HNFetcher) Name() string { return "hackernews" }

type hnItem struct {
	ID          int     `json:"id"`
	Title       string  `json:"title"`
	URL         string  `json:"url"`
	Text        string  `json:"text"`
	Score       float64 `json:"score"`
	Descendants float64 `json:"descendants"`
	Time        int64   `json:"time"`
}

func (f *HNFetcher) FetchItems(ctx context.Context, _ string) ([]domain.SourceItem, error) {
	var askIDs, showIDs, topIDs []int
	if err := shared.FetchJSONWithRetry(ctx, f.client, "https://hacker-news.firebaseio.com/v0/askstories.json", nil, &askIDs); err != nil {
		return nil, err
	}
	if err := shared.FetchJSONWithRetry(ctx, f.client, "https://hacker-news.firebaseio.com/v0/showstories.json", nil, &showIDs); err != nil {
		return nil, err
	}
	if err := shared.FetchJSONWithRetry(ctx, f.client, "https://hacker-news.firebaseio.com/v0/topstories.json", nil, &topIDs); err != nil {
		return nil, err
	}
	ids := uniqInts(append(append(sliceInts(askIDs, 80), sliceInts(showIDs, 80)...), sliceInts(topIDs, 40)...))
	ids = sliceInts(ids, 120)

	out := make([]domain.SourceItem, 0, len(ids))
	for _, id := range ids {
		var it hnItem
		u := fmt.Sprintf("https://hacker-news.firebaseio.com/v0/item/%d.json", id)
		if err := shared.FetchJSONWithRetry(ctx, f.client, u, nil, &it); err != nil {
			continue
		}
		if it.Title == "" {
			continue
		}
		url := it.URL
		if url == "" {
			url = fmt.Sprintf("https://news.ycombinator.com/item?id=%d", it.ID)
		}
		pub := time.Now().UTC().Format(time.RFC3339)
		if it.Time > 0 {
			pub = time.Unix(it.Time, 0).UTC().Format(time.RFC3339)
		}
		out = append(out, domain.SourceItem{
			Source:         domain.SourceHackerNews,
			ID:             fmt.Sprintf("%d", it.ID),
			Title:          it.Title,
			URL:            url,
			Score:          it.Score,
			Comments:       it.Descendants,
			PublishedAt:    pub,
			ContentSnippet: sanitizeText(it.Text),
		})
		if len(out) >= 80 {
			break
		}
	}
	return out, nil
}

func uniqInts(in []int) []int {
	seen := map[int]bool{}
	out := make([]int, 0, len(in))
	for _, v := range in {
		if seen[v] {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	return out
}

func sliceInts(in []int, n int) []int {
	if len(in) <= n {
		return in
	}
	return in[:n]
}
