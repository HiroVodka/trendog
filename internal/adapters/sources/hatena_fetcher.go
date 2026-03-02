package sources

import (
	"context"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/HiroVodka/trendog/internal/domain"
)

type HatenaFetcher struct {
	client *http.Client
}

func NewHatenaFetcher(client *http.Client) *HatenaFetcher {
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	return &HatenaFetcher{client: client}
}

func (f *HatenaFetcher) Name() string { return "hatena" }

func (f *HatenaFetcher) FetchItems(ctx context.Context, _ string) ([]domain.SourceItem, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://b.hatena.ne.jp/hotentry/it.rss", nil)
	res, err := f.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return nil, errors.New("hatena http error: " + string(b))
	}
	xmlBytes, _ := io.ReadAll(res.Body)
	xml := string(xmlBytes)
	items := reItemHatena.FindAllString(xml, -1)
	out := make([]domain.SourceItem, 0, len(items))
	for i, it := range items {
		title := decodeXML(matchTag(it, "title"))
		link := decodeXML(matchTag(it, "link"))
		desc := sanitizeText(decodeXML(matchTag(it, "description")))
		date := matchTag(it, "dc:date")
		if date == "" {
			date = time.Now().UTC().Format(time.RFC3339)
		}
		bc, _ := strconv.ParseFloat(matchTag(it, "hatena:bookmarkcount"), 64)
		if title == "" || link == "" {
			continue
		}
		out = append(out, domain.SourceItem{
			Source:         domain.SourceHatena,
			ID:             strconv.Itoa(i + 1),
			Title:          title,
			URL:            link,
			Score:          bc,
			Comments:       0,
			PublishedAt:    normalizeRFC3339(date),
			ContentSnippet: desc,
		})
		if len(out) >= 60 {
			break
		}
	}
	return out, nil
}

var reItemHatena = regexp.MustCompile(`(?s)<item\b.*?</item>`)

func matchTag(xml, tag string) string {
	re := regexp.MustCompile(`(?is)<` + regexp.QuoteMeta(tag) + `[^>]*>(.*?)</` + regexp.QuoteMeta(tag) + `>`)
	m := re.FindStringSubmatch(xml)
	if len(m) < 2 {
		return ""
	}
	return strings.TrimSpace(stripCDATA(m[1]))
}

func stripCDATA(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "<![CDATA[")
	s = strings.TrimSuffix(s, "]]>")
	return s
}

func decodeXML(s string) string {
	r := strings.NewReplacer("&amp;", "&", "&lt;", "<", "&gt;", ">", "&quot;", "\"", "&#39;", "'")
	s = r.Replace(s)
	s = decodeNumericEntities(s)
	return s
}

func decodeNumericEntities(s string) string {
	reHex := regexp.MustCompile(`&#x([0-9a-fA-F]+);`)
	s = reHex.ReplaceAllStringFunc(s, func(m string) string {
		h := reHex.FindStringSubmatch(m)[1]
		n, err := strconv.ParseInt(h, 16, 32)
		if err != nil {
			return m
		}
		return string(rune(n))
	})
	reDec := regexp.MustCompile(`&#([0-9]+);`)
	s = reDec.ReplaceAllStringFunc(s, func(m string) string {
		d := reDec.FindStringSubmatch(m)[1]
		n, err := strconv.ParseInt(d, 10, 32)
		if err != nil {
			return m
		}
		return string(rune(n))
	})
	return s
}

func sanitizeText(s string) string {
	re := regexp.MustCompile(`<[^>]+>`)
	s = re.ReplaceAllString(s, " ")
	s = strings.Join(strings.Fields(s), " ")
	if len(s) > 600 {
		return s[:600]
	}
	return s
}

func normalizeRFC3339(v string) string {
	if t, err := time.Parse(time.RFC3339, v); err == nil {
		return t.UTC().Format(time.RFC3339)
	}
	if t, err := time.Parse(time.RFC1123Z, v); err == nil {
		return t.UTC().Format(time.RFC3339)
	}
	if t, err := time.Parse(time.RFC1123, v); err == nil {
		return t.UTC().Format(time.RFC3339)
	}
	return time.Now().UTC().Format(time.RFC3339)
}
