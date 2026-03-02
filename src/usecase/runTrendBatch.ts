import {
  AppState,
  DEFAULT_MAX_TOPICS,
  EnrichedCluster,
  MAX_TOPICS_LIMIT
} from "../domain/model.js";
import { clusterByUrl, scoreItems } from "../domain/ranking.js";
import { renderMarkdown } from "../domain/markdown.js";
import { AIProvider } from "../ports/aiProvider.js";
import { Notifier } from "../ports/notifier.js";
import { SourceFetcher } from "../ports/sourceFetcher.js";
import { StateStore } from "../ports/stateStore.js";
import { sha256 } from "../shared/hash.js";
import { Logger } from "../shared/logger.js";
import { shouldPostOnDate, toJstDateString } from "../shared/time.js";

export interface RunOptions {
  mode: "normal" | "force";
  dryRun: boolean;
  maxTopics: number;
  debug: boolean;
  runId: string;
  audienceProfile: string;
  now?: Date;
}

interface Dependencies {
  fetchers: SourceFetcher[];
  stateStore: StateStore;
  aiProvider: AIProvider;
  notifier: Notifier;
  logger: Logger;
}

function clampTopics(maxTopics: number): number {
  if (!Number.isFinite(maxTopics)) return DEFAULT_MAX_TOPICS;
  return Math.max(1, Math.min(MAX_TOPICS_LIMIT, Math.floor(maxTopics)));
}

export async function runTrendBatch(deps: Dependencies, options: RunOptions): Promise<void> {
  const now = options.now ?? new Date();
  const jstDate = toJstDateString(now);
  const shouldPost = options.mode === "force" ? true : shouldPostOnDate(jstDate);

  const state = await deps.stateStore.load();
  const logBase = {
    run_id: options.runId,
    mode: options.mode,
    jst_date: jstDate,
    schedule_match: shouldPost
  };
  deps.logger.info("run start", logBase);

  if (options.mode === "normal" && !shouldPost) {
    deps.logger.info("skip by alternate-day rule", logBase);
    return;
  }

  if (state.postedHashes[jstDate] && options.mode === "normal") {
    deps.logger.info("skip by duplicate guard", logBase);
    return;
  }

  const fetchResults = await Promise.allSettled(
    deps.fetchers.map((fetcher) => fetcher.fetchItems(now.toISOString()))
  );
  const sourceCounts: Record<string, number> = {};
  const sourceItems = [];
  for (let i = 0; i < fetchResults.length; i += 1) {
    const fetcher = deps.fetchers[i];
    const res = fetchResults[i];
    if (!fetcher) continue;
    if (res?.status === "fulfilled") {
      sourceCounts[fetcher.name] = res.value.length;
      sourceItems.push(...res.value);
    } else {
      sourceCounts[fetcher.name] = 0;
      deps.logger.error("source failed", { source: fetcher.name, error: String(res?.reason) });
    }
  }

  const scored = scoreItems(sourceItems, now);
  const clusters = clusterByUrl(scored);
  const maxTopics = clampTopics(options.maxTopics);

  let enriched: EnrichedCluster[] = [];
  let aiFallback = false;
  try {
    enriched = await deps.aiProvider.enrich(clusters, options.audienceProfile);
  } catch (err) {
    aiFallback = true;
    deps.logger.error("ai enrich failed; fallback enabled", { error: String(err) });
  }

  const importantClusterIds = new Set(enriched.filter((e) => e.isImportant).map((e) => e.clusterId));
  let outputClusters = clusters.filter((c) => importantClusterIds.has(c.id)).slice(0, maxTopics);
  let outputEnriched = enriched.filter((e) => importantClusterIds.has(e.clusterId));

  if (outputClusters.length === 0) {
    outputClusters = clusters.slice(0, maxTopics);
    const existing = new Map(enriched.map((e) => [e.clusterId, e]));
    outputEnriched = outputClusters.map((c) => {
      const found = existing.get(c.id);
      if (found) return { ...found, isImportant: true };
      return {
        clusterId: c.id,
        summaryJa: "要約生成に失敗したため、元リンクを確認してください。",
        tags: [],
        reasonToRead: "対象読者の実務に関連する可能性が高いため。",
        isImportant: true
      };
    });
  }

  const markdown = renderMarkdown({
    jstDate,
    audienceProfile: options.audienceProfile,
    clusters: outputClusters,
    enriched: outputEnriched
  });

  const postHash = sha256(markdown);
  if (state.postedHashes[jstDate] === postHash && options.mode === "normal") {
    deps.logger.info("skip by same hash guard", { ...logBase, hash: postHash });
    return;
  }

  if (options.dryRun) {
    deps.logger.info("dryRun markdown", { ...logBase, markdown });
  } else {
    const result = await deps.notifier.notify(markdown);
    deps.logger.info("slack result", { ...logBase, status: result.status, ok: result.ok });
    if (!result.ok) {
      throw new Error(`slack webhook failed: ${result.status} ${result.body}`);
    }
  }

  const nextState: AppState = {
    lastRunJstDate: jstDate,
    itemsState: {
      ...state.itemsState,
      ...Object.fromEntries(
        scored.map((x) => [
          `${x.source}:${x.id}`,
          {
            score: x.score,
            comments: x.comments,
            lastSeen: now.toISOString()
          }
        ])
      )
    },
    postedHashes: {
      ...state.postedHashes,
      [jstDate]: postHash
    }
  };

  await deps.stateStore.save(nextState);
  deps.logger.info("run complete", {
    ...logBase,
    fetched: sourceCounts,
    clustered_count: clusters.length,
    important_count: importantClusterIds.size,
    selected_count: outputClusters.length,
    ai_calls: 1,
    ai_fallback: aiFallback
  });
}
