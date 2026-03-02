# trendog 🐶

![trendog character](./trendog.png)

> Beta: trendog は現在ベータ版です。仕様や出力フォーマットは今後変更される可能性があります。

trendog は、技術トレンド記事を定期収集し、Gemini で対象読者に重要な記事を選別・要約して Slack に投稿する Go 製バッチアプリです。

## 主な機能

- 収集ソース: Hatena Hotentry / Hacker News / Zenn
- 記事の重複統合（同一URL単位）
- Gemini による重要度判定（対象読者プロファイル可変）
- Important 判定の記事のみ Gemini で日本語要約
- Slack Incoming Webhook 投稿
- GitHub Actions の定期実行 + 手動実行
- Ports/Adapters 分離で実行基盤を差し替えやすい構成

## 投稿フォーマット

投稿される各記事は次の形式です。

- 記事タイトル
- URL
- 内容の要約
- おすすめ理由

## クイックスタート
### 1. 必須環境

- Go 1.22 以上

### 2. 環境変数を設定

```bash
export GEMINI_API_KEY='...'
export SLACK_WEBHOOK_URL='...'
export AUDIENCE_PROFILE='バックエンドエンジニア、SREエンジニア'
export STATE_FILE_PATH='state/state.json' # optional
```

### 3. ローカル実行

```bash
go run ./cmd/trendog
```

### 4. テスト実行

```bash
go test ./...
```

## GitHub Actions

Workflow: `.github/workflows/trendog.yml`

### スケジュール
- 毎日 `00:10 UTC` 起動
- アプリ内で JST の隔日判定を実施

### 手動実行 (`workflow_dispatch`)

入力:

- `mode`: `normal` / `force`
- `dryRun`: `true` / `false`
- `maxTopics`: 出力上限（デフォルト 17, 上限 30）
- `audienceProfile`: 重要度判定の対象読者
- `debug`: `true` / `false`

## 必須Secrets / Variables

Secrets:

- `GEMINI_API_KEY`
- `SLACK_WEBHOOK_URL`

Variables (任意):

- `GEMINI_MODEL` (default: `gemini-2.5-flash`)
- `AUDIENCE_PROFILE` (default: `バックエンドエンジニア、SREエンジニア`)

## Audience Profile 例

- `バックエンドエンジニア、SREエンジニア`
- `インフラエンジニア、プラットフォームエンジニア`
- `AIアプリケーション開発者`

## アーキテクチャ
- `internal/usecase`: バッチ実行フロー
- `internal/domain`: クラスタリング/スコアリング/Markdown整形
- `internal/ports`: 外部境界インターフェース
- `internal/adapters`: Sources / Gemini / Slack / State の実装
- `cmd/trendog`: エントリポイント

## 運用メモ

- ソース取得はリトライ付き
- Gemini失敗時はフォールバック投稿
- 重複投稿防止は `state/state.json` で管理

## License

MIT
