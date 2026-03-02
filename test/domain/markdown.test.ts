import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../src/domain/markdown.js";
import { Cluster } from "../../src/domain/model.js";

function makeCluster(id: string, title: string): Cluster {
  return {
    id,
    canonicalUrl: `https://example.com/${id}`,
    title,
    trendScore: 2,
    deltaScore: 5,
    deltaComments: 3,
    items: [
      {
        source: "hackernews",
        id: `${id}-item`,
        title,
        url: `https://example.com/${id}`,
        score: 10,
        comments: 3,
        publishedAt: "2026-03-02T00:00:00.000Z",
        ageHours: 1,
        deltaScore: 5,
        deltaComments: 3,
        trendScore: 2
      }
    ]
  };
}

describe("renderMarkdown", () => {
  it("renders required sections and enriched content", () => {
    const c1 = makeCluster("c1", "Topic A");
    const md = renderMarkdown({
      jstDate: "2026-03-02",
      topTopics: [c1],
      rising: [c1],
      deepDiscussion: [c1],
      enriched: [
        {
          clusterId: "c1",
          summaryJa: "要約です",
          tags: ["AI", "Backend"],
          reasonToRead: "読む価値あり"
        }
      ]
    });

    expect(md).toContain("今日のエンジニアトレンド（2026-03-02 JST）");
    expect(md).toContain("🧩 注目トピック Top 7");
    expect(md).toContain("🔥 急上昇 Top 5");
    expect(md).toContain("🧵 議論が深い Top 5");
    expect(md).toContain("要約です");
    expect(md).toContain("#AI #Backend");
    expect(md).toContain("理由: 読む価値あり");
  });

  it("falls back when enrichment is missing", () => {
    const c1 = makeCluster("c1", "Topic A");
    const md = renderMarkdown({
      jstDate: "2026-03-02",
      topTopics: [c1],
      rising: [],
      deepDiscussion: [],
      enriched: []
    });

    expect(md).toContain("要約生成に失敗したため、元リンクを確認してください。");
    expect(md).toContain("増分スコア:+5 / コメント:+3");
  });
});
