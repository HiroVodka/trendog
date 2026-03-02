import { GeminiProvider } from "./adapters/ai/geminiProvider.js";
import { SlackWebhookNotifier } from "./adapters/notifier/slackWebhookNotifier.js";
import { FileStateStore } from "./adapters/state/fileStateStore.js";
import { HackerNewsFetcher } from "./adapters/sources/hackerNewsFetcher.js";
import { HatenaFetcher } from "./adapters/sources/hatenaFetcher.js";
import { RedditFetcher } from "./adapters/sources/redditFetcher.js";
import { runTrendBatch } from "./usecase/runTrendBatch.js";
import { consoleLogger } from "./shared/logger.js";

export interface AppRuntimeOptions {
  mode: "normal" | "force";
  dryRun: boolean;
  maxTopics: number;
  debug: boolean;
  runId: string;
  geminiApiKey?: string;
  slackWebhookUrl?: string;
  redditUserAgent?: string;
  stateFilePath?: string;
}

export async function runApp(opts: AppRuntimeOptions): Promise<void> {
  const geminiApiKey = opts.geminiApiKey ?? process.env.GEMINI_API_KEY ?? "";
  const slackWebhookUrl = opts.slackWebhookUrl ?? process.env.SLACK_WEBHOOK_URL ?? "";
  const redditUserAgent = opts.redditUserAgent ?? process.env.REDDIT_USER_AGENT ?? "trendog-bot/0.1";
  const stateFilePath = opts.stateFilePath ?? process.env.STATE_FILE_PATH ?? "state/state.json";

  const fetchers = [
    new HatenaFetcher(),
    new HackerNewsFetcher(),
    new RedditFetcher(redditUserAgent)
  ];

  await runTrendBatch(
    {
      fetchers,
      stateStore: new FileStateStore(stateFilePath),
      aiProvider: new GeminiProvider(geminiApiKey),
      notifier: new SlackWebhookNotifier(slackWebhookUrl),
      logger: consoleLogger
    },
    opts
  );
}
