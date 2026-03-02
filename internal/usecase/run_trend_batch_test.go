package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/HiroVodka/trendog/internal/domain"
	"github.com/HiroVodka/trendog/internal/ports"
)

type mockFetcher struct {
	items []domain.SourceItem
	err   error
}

func (m mockFetcher) Name() string { return "mock" }
func (m mockFetcher) FetchItems(context.Context, string) ([]domain.SourceItem, error) {
	return m.items, m.err
}

type memStore struct {
	s     domain.AppState
	saved *domain.AppState
}

func (m *memStore) Load(context.Context) (domain.AppState, error)   { return m.s, nil }
func (m *memStore) Save(_ context.Context, s domain.AppState) error { m.saved = &s; return nil }

type mockAI struct {
	out []domain.EnrichedCluster
	err error
}

func (m mockAI) Enrich(context.Context, []domain.Cluster, string) ([]domain.EnrichedCluster, error) {
	return m.out, m.err
}

type mockNotifier struct {
	called int
	ok     bool
}

func (m *mockNotifier) Notify(context.Context, string) (ports.NotifyResult, error) {
	m.called++
	return ports.NotifyResult{OK: m.ok, Status: 200}, nil
}

type nullLogger struct{}

func (nullLogger) Info(string, map[string]interface{})  {}
func (nullLogger) Warn(string, map[string]interface{})  {}
func (nullLogger) Error(string, map[string]interface{}) {}

func TestRunTrendBatchDryRun(t *testing.T) {
	store := &memStore{s: domain.AppState{ItemsState: map[string]domain.ItemState{}, PostedHashes: map[string]string{}}}
	n := &mockNotifier{ok: true}
	item := domain.SourceItem{Source: domain.SourceHackerNews, ID: "1", Title: "A", URL: "https://e/a", Score: 10, PublishedAt: time.Now().UTC().Format(time.RFC3339)}
	err := RunTrendBatch(context.Background(), Dependencies{
		Fetchers:   []ports.SourceFetcher{mockFetcher{items: []domain.SourceItem{item}}},
		StateStore: store,
		AI:         mockAI{out: []domain.EnrichedCluster{{ClusterID: "cluster_1", IsImportant: true, SummaryJA: "s", ReasonToRead: "r"}}},
		Notifier:   n,
		Logger:     nullLogger{},
	}, RunOptions{Mode: "force", DryRun: true, MaxTopics: 10, RunID: "r1", AudienceProfile: "backend"})
	if err != nil {
		t.Fatal(err)
	}
	if n.called != 0 {
		t.Fatalf("notifier should not be called")
	}
	if store.saved == nil {
		t.Fatalf("state not saved")
	}
}

func TestRunTrendBatchSlackFail(t *testing.T) {
	store := &memStore{s: domain.AppState{ItemsState: map[string]domain.ItemState{}, PostedHashes: map[string]string{}}}
	n := &mockNotifier{ok: false}
	item := domain.SourceItem{Source: domain.SourceHackerNews, ID: "1", Title: "A", URL: "https://e/a", Score: 10, PublishedAt: time.Now().UTC().Format(time.RFC3339)}
	err := RunTrendBatch(context.Background(), Dependencies{
		Fetchers:   []ports.SourceFetcher{mockFetcher{items: []domain.SourceItem{item}}},
		StateStore: store,
		AI:         mockAI{err: errors.New("ai down")},
		Notifier:   n,
		Logger:     nullLogger{},
	}, RunOptions{Mode: "force", DryRun: false, MaxTopics: 10, RunID: "r1", AudienceProfile: "backend"})
	if err == nil {
		t.Fatalf("expected error")
	}
}
