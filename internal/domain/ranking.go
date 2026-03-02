package domain

import (
	"math"
	"net/url"
	"sort"
	"strings"
	"time"
)

func ScoreItems(items []SourceItem, now time.Time) []ScoredItem {
	out := make([]ScoredItem, 0, len(items))
	for _, item := range items {
		age := ageHours(now, item.PublishedAt)
		freshness := math.Exp(-age / 24)
		rank := (item.Score + 0.5*item.Comments) * freshness
		out = append(out, ScoredItem{SourceItem: item, AgeHours: age, RankScore: rank})
	}
	return out
}

func ClusterByURL(items []ScoredItem) []Cluster {
	m := map[string]*Cluster{}
	order := 0
	for _, item := range items {
		key := canonicalizeURL(item.URL)
		if key == "" {
			key = string(item.Source) + ":" + item.ID
		}
		if c, ok := m[key]; ok {
			c.Items = append(c.Items, item)
			c.RankScore += item.RankScore
			if item.RankScore > c.Items[0].RankScore {
				c.Title = item.Title
			}
			continue
		}
		order++
		cl := &Cluster{
			ID:           "cluster_" + itoa(order),
			CanonicalURL: key,
			Title:        item.Title,
			Items:        []ScoredItem{item},
			RankScore:    item.RankScore,
		}
		m[key] = cl
	}
	out := make([]Cluster, 0, len(m))
	for _, c := range m {
		out = append(out, *c)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].RankScore > out[j].RankScore })
	return out
}

func canonicalizeURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	u.Fragment = ""
	u.Path = strings.TrimSuffix(u.Path, "/")
	return u.String()
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := [20]byte{}
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

func ageHours(now time.Time, publishedAt string) float64 {
	pt, err := time.Parse(time.RFC3339, publishedAt)
	if err != nil {
		return 999
	}
	d := now.Sub(pt)
	if d < 0 {
		return 0
	}
	return d.Hours()
}
