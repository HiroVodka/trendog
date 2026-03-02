import { describe, expect, it, vi } from "vitest";
import { SourceFetcher } from "../../src/ports/sourceFetcher.js";
import { StateStore } from "../../src/ports/stateStore.js";
import { AIProvider } from "../../src/ports/aiProvider.js";
import { Notifier } from "../../src/ports/notifier.js";
import { AppState, Cluster, EnrichedCluster, SourceItem } from "../../src/domain/model.js";
import { runTrendBatch } from "../../src/usecase/runTrendBatch.js";
import { Logger } from "../../src/shared/logger.js";

class MemoryStateStore implements StateStore {
  public saved?: AppState;
  constructor(private readonly current: AppState) {}
  async load(): Promise<AppState> {
    return this.current;
  }
  async save(state: AppState): Promise<void> {
    this.saved = state;
  }
}

function fetcher(items: SourceItem[]): SourceFetcher {
  return {
    name: "mock",
    fetchItems: vi.fn(async () => items)
  };
}

function logger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function ai(enriched: EnrichedCluster[] | Error): AIProvider {
  return {
    enrich: vi.fn(async (_clusters: Cluster[]) => {
      if (enriched instanceof Error) throw enriched;
      return enriched;
    })
  };
}

function notifier(ok = true): Notifier {
  return {
    notify: vi.fn(async () => ({ ok, status: ok ? 200 : 500, body: ok ? "ok" : "fail" }))
  };
}

const evenJstNow = new Date("2026-03-02T01:00:00+09:00");
const oddJstNow = new Date("2026-03-03T01:00:00+09:00");

const item: SourceItem = {
  source: "hackernews",
  id: "1",
  title: "Topic",
  url: "https://example.com/topic",
  score: 20,
  comments: 5,
  publishedAt: "2026-03-01T23:00:00.000Z"
};

describe("runTrendBatch", () => {
  it("skips on odd JST day in normal mode", async () => {
    const state = new MemoryStateStore({ itemsState: {}, postedHashes: {} });
    const f = fetcher([item]);
    const a = ai([]);
    const n = notifier();

    await runTrendBatch(
      { fetchers: [f], stateStore: state, aiProvider: a, notifier: n, logger: logger() },
      { mode: "normal", dryRun: false, maxTopics: 17, debug: false, runId: "r1", now: oddJstNow }
    );

    expect(f.fetchItems).not.toHaveBeenCalled();
    expect(state.saved).toBeUndefined();
  });

  it("runs in force mode and saves state without Slack call in dryRun", async () => {
    const state = new MemoryStateStore({ itemsState: {}, postedHashes: {} });
    const f = fetcher([item]);
    const a = ai([
      {
        clusterId: "cluster_1",
        summaryJa: "要約",
        tags: ["AI"],
        reasonToRead: "理由"
      }
    ]);
    const n = notifier();

    await runTrendBatch(
      { fetchers: [f], stateStore: state, aiProvider: a, notifier: n, logger: logger() },
      { mode: "force", dryRun: true, maxTopics: 17, debug: false, runId: "r2", now: oddJstNow }
    );

    expect(f.fetchItems).toHaveBeenCalledTimes(1);
    expect(a.enrich).toHaveBeenCalledTimes(1);
    expect(n.notify).not.toHaveBeenCalled();
    expect(state.saved?.lastRunJstDate).toBe("2026-03-03");
    expect(Object.keys(state.saved?.postedHashes ?? {})).toContain("2026-03-03");
  });

  it("skips duplicate on same JST date in normal mode", async () => {
    const state = new MemoryStateStore({
      itemsState: {},
      postedHashes: { "2026-03-02": "already" }
    });
    const f = fetcher([item]);

    await runTrendBatch(
      {
        fetchers: [f],
        stateStore: state,
        aiProvider: ai([]),
        notifier: notifier(),
        logger: logger()
      },
      { mode: "normal", dryRun: false, maxTopics: 17, debug: false, runId: "r3", now: evenJstNow }
    );

    expect(f.fetchItems).not.toHaveBeenCalled();
    expect(state.saved).toBeUndefined();
  });

  it("falls back when AI fails and still posts", async () => {
    const state = new MemoryStateStore({ itemsState: {}, postedHashes: {} });
    const n = notifier(true);

    await runTrendBatch(
      {
        fetchers: [fetcher([item])],
        stateStore: state,
        aiProvider: ai(new Error("ai down")),
        notifier: n,
        logger: logger()
      },
      { mode: "normal", dryRun: false, maxTopics: 17, debug: false, runId: "r4", now: evenJstNow }
    );

    expect(n.notify).toHaveBeenCalledTimes(1);
    expect(state.saved?.lastRunJstDate).toBe("2026-03-02");
  });

  it("throws when Slack notification fails", async () => {
    const state = new MemoryStateStore({ itemsState: {}, postedHashes: {} });

    await expect(
      runTrendBatch(
        {
          fetchers: [fetcher([item])],
          stateStore: state,
          aiProvider: ai([]),
          notifier: notifier(false),
          logger: logger()
        },
        { mode: "normal", dryRun: false, maxTopics: 17, debug: false, runId: "r5", now: evenJstNow }
      )
    ).rejects.toThrow("slack webhook failed");
  });
});
