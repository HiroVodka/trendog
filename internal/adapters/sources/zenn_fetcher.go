package sources

import (
	"context"
	"errors"
	"io"
	"net/http"
	"regexp"
	"time"

	"github.com/HiroVodka/trendog/internal/domain"
)

type ZennFetcher struct{ client *http.Client }

func NewZennFetcher(client *http.Client) *ZennFetcher {
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	return &ZennFetcher{client: client}
}

func (f *ZennFetcher) Name() string { return "zenn" }

func (f *ZennFetcher) FetchItems(ctx context.Context, _ string) ([]domain.SourceItem, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://zenn.dev/feed", nil)
	res, err := f.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return nil, errors.New("zenn http error: " + string(b))
	}
	xmlBytes, _ := io.ReadAll(res.Body)
	xml := string(xmlBytes)
	items := reItemZenn.FindAllString(xml, -1)
	out := make([]domain.SourceItem, 0, len(items))
	for i, it := range items {
		title := decodeXML(matchTag(it, "title"))
		link := decodeXML(matchTag(it, "link"))
		guid := decodeXML(matchTag(it, "guid"))
		if guid == "" {
			guid = link
		}
		desc := sanitizeText(decodeXML(matchTag(it, "description")))
		pub := normalizeRFC3339(matchTag(it, "pubDate"))
		if title == "" || link == "" || guid == "" {
			continue
		}
		out = append(out, domain.SourceItem{
			Source:         domain.SourceZenn,
			ID:             guid,
			Title:          title,
			URL:            link,
			Score:          float64(100 - i),
			Comments:       0,
			PublishedAt:    pub,
			ContentSnippet: desc,
		})
		if len(out) >= 60 {
			break
		}
	}
	return out, nil
}

var reItemZenn = regexp.MustCompile(`(?s)<item\b.*?</item>`)
