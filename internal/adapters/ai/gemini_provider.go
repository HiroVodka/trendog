package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/HiroVodka/trendog/internal/domain"
)

type GeminiProvider struct {
	APIKey string
	Model  string
	Client *http.Client
}

type importanceResp struct {
	Clusters []struct {
		ClusterID    string `json:"clusterId"`
		IsImportant  bool   `json:"isImportant"`
		ReasonToRead string `json:"reasonToRead"`
	} `json:"clusters"`
}

type summaryResp struct {
	Clusters []struct {
		ClusterID    string   `json:"clusterId"`
		SummaryJA    string   `json:"summaryJa"`
		Tags         []string `json:"tags"`
		ReasonToRead string   `json:"reasonToRead"`
	} `json:"clusters"`
}

func (g GeminiProvider) Enrich(ctx context.Context, clusters []domain.Cluster, audience string) ([]domain.EnrichedCluster, error) {
	if g.APIKey == "" {
		return nil, errors.New("GEMINI_API_KEY is missing")
	}
	models := uniqStrings([]string{defaultString(g.Model, "gemini-2.5-flash"), "gemini-flash-latest", "gemini-2.5-flash-lite"})
	impPrompt := buildImportancePrompt(clusters, audience)

	var imp importanceResp
	if err := g.runAcrossModels(ctx, models, impPrompt, &imp); err != nil {
		return nil, err
	}
	impMap := map[string]struct {
		important bool
		reason    string
	}{}
	importantClusters := make([]domain.Cluster, 0)
	for _, c := range imp.Clusters {
		impMap[c.ClusterID] = struct {
			important bool
			reason    string
		}{important: c.IsImportant, reason: c.ReasonToRead}
		if c.IsImportant {
			for _, cl := range clusters {
				if cl.ID == c.ClusterID {
					importantClusters = append(importantClusters, cl)
					break
				}
			}
		}
	}

	sumMap := map[string]summaryResp{}
	if len(importantClusters) > 0 {
		sumPrompt := buildSummaryPrompt(importantClusters, audience)
		var sum summaryResp
		if err := g.runAcrossModels(ctx, models, sumPrompt, &sum); err == nil {
			sumMap["all"] = sum
		}
	}

	out := make([]domain.EnrichedCluster, 0, len(clusters))
	for _, cl := range clusters {
		info := impMap[cl.ID]
		e := domain.EnrichedCluster{ClusterID: cl.ID, IsImportant: info.important, ReasonToRead: info.reason}
		if sum, ok := sumMap["all"]; ok {
			for _, s := range sum.Clusters {
				if s.ClusterID == cl.ID {
					e.SummaryJA = s.SummaryJA
					e.ReasonToRead = s.ReasonToRead
					e.Tags = filterTags(s.Tags)
					break
				}
			}
		}
		out = append(out, e)
	}
	return out, nil
}

func (g GeminiProvider) runAcrossModels(ctx context.Context, models []string, prompt string, out interface{}) error {
	errs := make([]string, 0, len(models))
	for _, m := range models {
		if err := g.callModel(ctx, m, prompt, out); err == nil {
			return nil
		} else {
			errs = append(errs, fmt.Sprintf("[%s] %v", m, err))
		}
	}
	return errors.New("gemini enrich failed: " + strings.Join(errs, " | "))
}

func (g GeminiProvider) callModel(ctx context.Context, model, prompt string, out interface{}) error {
	client := g.Client
	if client == nil {
		client = &http.Client{Timeout: 35 * time.Second}
	}
	payload := map[string]interface{}{
		"generationConfig": map[string]interface{}{"temperature": 0.2, "responseMimeType": "application/json"},
		"contents":         []map[string]interface{}{{"role": "user", "parts": []map[string]string{{"text": prompt}}}},
	}
	b, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", model)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-goog-api-key", g.APIKey)
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("http %d %s", res.StatusCode, truncate(string(body), 400))
	}
	var data struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return err
	}
	text := ""
	for _, p := range data.Candidates {
		for _, pp := range p.Content.Parts {
			text += pp.Text + "\n"
		}
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return errors.New("empty response text")
	}
	jsonText := extractJSON(text)
	return json.Unmarshal([]byte(jsonText), out)
}

func buildImportancePrompt(clusters []domain.Cluster, audience string) string {
	payload := make([]map[string]interface{}, 0, len(clusters))
	for _, c := range clusters {
		payload = append(payload, map[string]interface{}{"clusterId": c.ID, "title": c.Title, "canonicalUrl": c.CanonicalURL, "links": clusterLinks(c), "sources": clusterSources(c)})
	}
	in, _ := json.Marshal(payload)
	return strings.Join([]string{
		"あなたはエンジニア向けトレンド編集者です。",
		"対象読者: " + audience,
		"以下のクラスタ一覧について、対象読者に重要か判定し、理由を1行で返してください。",
		"出力は厳密なJSONのみ。",
		"形式: {\"clusters\":[{\"clusterId\":\"...\",\"isImportant\":true,\"reasonToRead\":\"...\"}]}",
		"入力:", string(in),
	}, "\n")
}

func buildSummaryPrompt(clusters []domain.Cluster, audience string) string {
	payload := make([]map[string]interface{}, 0, len(clusters))
	for _, c := range clusters {
		links := make([]map[string]string, 0, len(c.Items))
		for _, it := range c.Items {
			links = append(links, map[string]string{"url": it.URL, "snippet": it.ContentSnippet})
		}
		payload = append(payload, map[string]interface{}{"clusterId": c.ID, "title": c.Title, "canonicalUrl": c.CanonicalURL, "links": links, "sources": clusterSources(c)})
	}
	in, _ := json.Marshal(payload)
	return strings.Join([]string{
		"あなたはエンジニア向けトレンド編集者です。",
		"対象読者: " + audience,
		"以下は重要判定済みクラスタです。本文抜粋も参考に要約してください。",
		"各クラスタについて summaryJa(日本語3-5行), tags(最大3), reasonToRead(1行) を返してください。",
		"tags候補: " + strings.Join(domain.TagCandidates, ", "),
		"出力は厳密なJSONのみ。",
		"形式: {\"clusters\":[{\"clusterId\":\"...\",\"summaryJa\":\"...\",\"tags\":[\"...\"],\"reasonToRead\":\"...\"}]}",
		"入力:", string(in),
	}, "\n")
}

func clusterLinks(c domain.Cluster) []string {
	out := make([]string, 0, len(c.Items))
	for i, it := range c.Items {
		if i >= 3 {
			break
		}
		out = append(out, it.URL)
	}
	return out
}

func clusterSources(c domain.Cluster) []string {
	m := map[string]bool{}
	for _, it := range c.Items {
		m[string(it.Source)] = true
	}
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func extractJSON(text string) string {
	re := regexp.MustCompile("(?s)```(?:json)?\\s*(.*?)\\s*```")
	if m := re.FindStringSubmatch(text); len(m) == 2 {
		return m[1]
	}
	i := strings.Index(text, "{")
	j := strings.LastIndex(text, "}")
	if i >= 0 && j > i {
		return text[i : j+1]
	}
	return text
}

func filterTags(tags []string) []string {
	allowed := map[string]bool{}
	for _, t := range domain.TagCandidates {
		allowed[t] = true
	}
	out := make([]string, 0, 3)
	for _, t := range tags {
		if allowed[t] {
			out = append(out, t)
			if len(out) >= 3 {
				break
			}
		}
	}
	return out
}

func uniqStrings(in []string) []string {
	m := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, v := range in {
		if v == "" || m[v] {
			continue
		}
		m[v] = true
		out = append(out, v)
	}
	return out
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func defaultString(v, d string) string {
	if strings.TrimSpace(v) == "" {
		return d
	}
	return v
}
