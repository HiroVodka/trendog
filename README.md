# trendog

エンジニア向けトレンド情報を収集し、Geminiで加工してSlackへ投稿するバッチアプリです。

## 実行基盤

- 第一基盤: GitHub Actions (`.github/workflows/trendog.yml`)
- スケジュール: 毎日 `00:10 UTC` 起動
- 投稿判定: JST隔日 (`2026-03-02` をアンカーに `days_since_anchor % 2 == 0`)

## アーキテクチャ

- `src/usecase` / `src/domain`: コアロジック
- `src/ports`: `SourceFetcher`, `StateStore`, `AIProvider`, `Notifier`
- `src/adapters`: GitHub Actions, Workers, Slack, Gemini, 各ソース, state file

Cloudflare Workers移行時は、主に `src/adapters/githubActions/main.ts` を `src/adapters/workers/handler.ts` に切り替え、`StateStore` 実装をKV版へ差し替える想定です。

## 必要なSecrets/Vars

- `GEMINI_API_KEY`
- `SLACK_WEBHOOK_URL`

収集ソース（現行）:
- Hatena Hotentry
- Hacker News
- Zenn Feed

## 手動実行

`workflow_dispatch` inputs:

- `mode`: `normal` / `force`
- `dryRun`: `true` / `false`
- `maxTopics`: default `17`, max `30`
- `debug`: `true` / `false`

## ローカル実行

```bash
npm ci
npm run run
```

環境変数例:

```bash
export MODE=force
export DRY_RUN=true
export MAX_TOPICS=17
export DEBUG=true
export GEMINI_API_KEY=...
export SLACK_WEBHOOK_URL=...
```

## 状態ファイル

- 既定: `state/state.json`
- 保存内容:
  - `lastRunJstDate`
  - `itemsState` (source:idごとのscore/comments/lastSeen)
  - `postedHashes` (日次二重投稿防止)

## 備考

- ソース取得はHTTPリトライあり（指数バックオフ、最大3回）
- Geminiは最大2回リトライ、失敗時はAI無しフォールバック
- Slack投稿はIncoming Webhook
