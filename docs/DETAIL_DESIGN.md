# 詳細設計（Go版）

## 1. Ports

### `SourceFetcher`

```go
type SourceFetcher interface {
	Name() string
	FetchItems(ctx context.Context, nowISO string) ([]domain.SourceItem, error)
}
```

### `StateStore`

```go
type StateStore interface {
	Load(ctx context.Context) (domain.AppState, error)
	Save(ctx context.Context, state domain.AppState) error
}
```

### `AIProvider`

```go
type AIProvider interface {
	Enrich(ctx context.Context, clusters []domain.Cluster, audienceProfile string) ([]domain.EnrichedCluster, error)
}
```

### `Notifier`

```go
type Notifier interface {
	Notify(ctx context.Context, markdown string) (NotifyResult, error)
}
```

## 2. Adapters

- Sources: `HatenaFetcher`, `HNFetcher`, `ZennFetcher`
- AI: `GeminiProvider`
- Notifier: `SlackWebhookNotifier`
- State: `FileStateStore`
- Runtime entry: `cmd/trendog/main.go`

## 3. Gemini 出力JSON

### 重要度判定

```json
{
  "clusters": [
    {
      "clusterId": "cluster_1",
      "isImportant": true,
      "reasonToRead": "理由"
    }
  ]
}
```

### Important記事の要約

```json
{
  "clusters": [
    {
      "clusterId": "cluster_1",
      "summaryJa": "日本語要約",
      "tags": ["Backend", "SRE"],
      "reasonToRead": "おすすめ理由"
    }
  ]
}
```

## 4. 実行フロー（要点）

1. ソース収集（Hatena/HN/Zenn）
2. URL単位でクラスタ統合
3. Geminiで対象読者に対する重要度判定
4. Important記事のみGeminiで要約
5. Markdown生成
6. Slack投稿（`dryRun`時は送信しない）
7. state保存（重複投稿防止）
