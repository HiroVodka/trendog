# 詳細設計（叩き台）

## 1. Ports インターフェース

### 1.1 `SourceFetcher`

```ts
interface SourceFetcher {
  name: string;
  fetchItems(nowIso: string): Promise<SourceItem[]>;
}
```

`SourceItem`:

```json
{
  "source": "hatena|hackernews|reddit",
  "id": "string",
  "title": "string",
  "url": "https://...",
  "score": 123,
  "comments": 45,
  "publishedAt": "2026-03-02T00:00:00.000Z"
}
```

### 1.2 `StateStore`

```ts
interface StateStore {
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
}
```

`AppState`:

```json
{
  "lastRunJstDate": "2026-03-02",
  "itemsState": {
    "reddit:golang:abc123": {
      "score": 123,
      "comments": 45,
      "lastSeen": "2026-03-02T00:00:00.000Z"
    }
  },
  "postedHashes": {
    "2026-03-02": "sha256..."
  }
}
```

### 1.3 `AIProvider`

```ts
interface AIProvider {
  enrich(clusters: Cluster[]): Promise<EnrichedCluster[]>;
}
```

### 1.4 `Notifier`

```ts
interface Notifier {
  notify(markdown: string): Promise<{ ok: boolean; status: number; body: string }>;
}
```

## 2. Adapters 一覧

- Sources:
  - `HatenaFetcher`
  - `HackerNewsFetcher`
  - `RedditFetcher`
- AI:
  - `GeminiProvider`
- Notifier:
  - `SlackWebhookNotifier`
- State:
  - `FileStateStore`
- Runtime entry:
  - GitHub Actions: `src/adapters/githubActions/main.ts`
  - Workers: `src/adapters/workers/handler.ts`

## 3. Gemini 厳格JSONスキーマ

期待レスポンス:

```json
{
  "clusters": [
    {
      "clusterId": "cluster_1",
      "summaryJa": "...",
      "tags": ["AI", "Backend"],
      "reasonToRead": "増分スコアと技術的含意が大きい"
    }
  ]
}
```

制約:

- `summaryJa`: 日本語、3〜5行
- `tags`: 固定カテゴリから最大3
- `reasonToRead`: 1行
- JSON以外を出力した場合はリトライ対象

## 4. Gemini プロンプト案

```
あなたはエンジニア向けトレンド編集者です。
以下のクラスタ一覧を処理してください。
各クラスタについて summaryJa(日本語3-5行), tags(固定カテゴリから最大3), reasonToRead(1行) を返してください。
tagsは候補のみ使用してください。
出力は厳密にJSONのみ。JSON以外の文字列を含めないでください。
```

## 5. ランキング

- `delta_score`, `delta_comments` を前回stateとの差分で算出
- `freshness = exp(-age_hours / 18)`
- `trend = (log1p(delta_score) + 0.7*log1p(delta_comments) + 0.2*log1p(score_now)) * freshness`

## 6. 投稿セクション

- 🧩 注目トピック Top 7
- 🔥 急上昇 Top 5
- 🧵 議論が深い Top 5

各要素:

- タイトル
- 要約（3〜5行）
- タグ（最大3）
- 読む理由（1行）
- 代表リンク（最大2）
