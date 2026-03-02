import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "../../../src/adapters/ai/geminiProvider.js";
import { Cluster } from "../../../src/domain/model.js";

function sampleCluster(): Cluster {
  return {
    id: "cluster_1",
    canonicalUrl: "https://example.com/topic",
    title: "Topic",
    trendScore: 2,
    deltaScore: 5,
    deltaComments: 3,
    items: [
      {
        source: "hackernews",
        id: "1",
        title: "Topic",
        url: "https://example.com/topic",
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

describe("GeminiProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when API key is missing", async () => {
    const provider = new GeminiProvider("");
    await expect(provider.enrich([sampleCluster()])).rejects.toThrow("GEMINI_API_KEY is missing");
  });

  it("parses strict JSON and filters unknown tags", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      clusters: [
                        {
                          clusterId: "cluster_1",
                          summaryJa: "要約",
                          tags: ["AI", "UnknownTag"],
                          reasonToRead: "理由"
                        }
                      ]
                    })
                  }
                ]
              }
            }
          ]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiProvider("test-key");
    const result = await provider.enrich([sampleCluster()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        clusterId: "cluster_1",
        summaryJa: "要約",
        tags: ["AI"],
        reasonToRead: "理由"
      }
    ]);
  });

  it("parses JSON wrapped in code fences and multi-part response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: "```json\n" },
                  {
                    text: JSON.stringify({
                      clusters: [
                        {
                          clusterId: "cluster_1",
                          summaryJa: "要約2",
                          tags: ["Backend"],
                          reasonToRead: "理由2"
                        }
                      ]
                    })
                  },
                  { text: "\n```" }
                ]
              }
            }
          ]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiProvider("test-key");
    const result = await provider.enrich([sampleCluster()]);

    expect(result).toEqual([
      {
        clusterId: "cluster_1",
        summaryJa: "要約2",
        tags: ["Backend"],
        reasonToRead: "理由2"
      }
    ]);
  });
});
