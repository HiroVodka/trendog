package sources

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type rt func(*http.Request) (*http.Response, error)

func (f rt) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestHatenaFetcher(t *testing.T) {
	rss := `<?xml version="1.0"?><rdf:RDF><item><title>A</title><link>https://e/a</link><description>desc</description><dc:date>2026-03-01T00:00:00Z</dc:date><hatena:bookmarkcount>12</hatena:bookmarkcount></item></rdf:RDF>`
	client := &http.Client{Transport: rt(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(rss)), Header: make(http.Header)}, nil
	})}
	items, err := NewHatenaFetcher(client).FetchItems(context.Background(), "")
	if err != nil || len(items) != 1 || items[0].Score != 12 {
		t.Fatalf("unexpected: err=%v len=%d score=%v", err, len(items), items[0].Score)
	}
}

func TestZennFetcher(t *testing.T) {
	rss := `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Zenn T]]></title><link>https://zenn.dev/a</link><guid>gid</guid><description><![CDATA[desc]]></description><pubDate>Mon, 02 Mar 2026 01:02:43 GMT</pubDate></item></channel></rss>`
	client := &http.Client{Transport: rt(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(rss)), Header: make(http.Header)}, nil
	})}
	items, err := NewZennFetcher(client).FetchItems(context.Background(), "")
	if err != nil || len(items) != 1 || items[0].ID != "gid" {
		t.Fatalf("unexpected: err=%v len=%d id=%v", err, len(items), items[0].ID)
	}
}

func TestHNFetcher(t *testing.T) {
	client := &http.Client{Transport: rt(func(r *http.Request) (*http.Response, error) {
		u := r.URL.String()
		body := `[]`
		switch {
		case strings.Contains(u, "askstories"):
			body = `[1001]`
		case strings.Contains(u, "showstories"):
			body = `[1002]`
		case strings.Contains(u, "topstories"):
			body = `[1003]`
		case strings.Contains(u, "/item/1001"):
			body = `{"id":1001,"title":"Ask HN","score":10,"descendants":3,"time":1700000000,"text":"<p>hello</p>"}`
		case strings.Contains(u, "/item/1002"):
			body = `{"id":1002,"title":"Show HN","score":8,"descendants":2,"time":1700000100}`
		case strings.Contains(u, "/item/1003"):
			body = `{"id":1003,"title":"Top","score":5,"descendants":1,"time":1700000200}`
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}
	items, err := NewHNFetcher(client).FetchItems(context.Background(), "")
	if err != nil || len(items) != 3 {
		t.Fatalf("unexpected: err=%v len=%d", err, len(items))
	}
}
