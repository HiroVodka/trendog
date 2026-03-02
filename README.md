# trendog 🐶

![trendog character](./trendog.png)

> Beta: trendog は現在ベータ版です。仕様や出力フォーマットは今後変更される可能性があります。

trendog は、技術トレンド記事を定期収集し、Gemini で対象読者にとって重要な記事を選別・要約して Slack に投稿するバッチアプリです。

## Features

- 複数ソースのトレンド記事を収集
- 収集ソース: Hatena Hotentry / Hacker News / Zenn Feed
- Gemini による重要度判定（対象読者プロファイルに基づく）
- 重要記事のみを Slack へ投稿
- GitHub Actions 定期実行（JST隔日判定）
- `workflow_dispatch` による手動実行
- 将来の Workers 移行を想定した Ports/Adapters 分離

## Output Format

投稿される各記事のフォーマット:

- 記事タイトル
- URL
- 内容の要約
- おすすめ理由

## Quick Start

### 1. Install

```bash
npm ci
```

### 2. Set env vars (local)

```bash
export GEMINI_API_KEY='...'
export SLACK_WEBHOOK_URL='...'
export AUDIENCE_PROFILE='バックエンドエンジニア、SREエンジニア'
```

### 3. Run

```bash
npm run run
```

## GitHub Actions Usage

Workflow: `.github/workflows/trendog.yml`

### Schedule

- 毎日 `00:10 UTC` に起動
- ジョブ内部で JST 隔日判定を実施

### Manual Run (`workflow_dispatch`)

入力パラメータ:

- `mode`: `normal` / `force`
- `dryRun`: `true` / `false`
- `maxTopics`: 出力上限（既定 17）
- `audienceProfile`: Gemini が重要判定するときの対象読者
- `debug`: `true` / `false`

## Required Secrets / Variables

GitHub Secrets:

- `GEMINI_API_KEY`
- `SLACK_WEBHOOK_URL`

GitHub Variables (optional):

- `GEMINI_MODEL` (default: `gemini-2.5-flash`)
- `AUDIENCE_PROFILE` (default: `バックエンドエンジニア、SREエンジニア`)

## Recommended Audience Profile Examples

- `バックエンドエンジニア、SREエンジニア`
- `インフラエンジニア、プラットフォームエンジニア`
- `AIアプリケーション開発者`

## Development

```bash
npm run typecheck
npm test
npm run build
```

## Project Structure

- `src/usecase`: 実行フローのユースケース
- `src/domain`: スコアリング・整形などのドメインロジック
- `src/ports`: インターフェース定義
- `src/adapters`: 外部I/O実装（Sources / Gemini / Slack / Runtime）
- `state/state.json`: 実行状態（重複投稿防止、前回値）

## Notes

- ソース取得はリトライ付き
- Gemini失敗時はフォールバックして投稿継続
- 同日重複投稿は state で防止

## License

公開時にライセンスファイルを追加してください（例: MIT）。
