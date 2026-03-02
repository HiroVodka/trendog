import { z } from "zod";
import { Cluster, EnrichedCluster, TAG_CANDIDATES } from "../../domain/model.js";
import { AIProvider } from "../../ports/aiProvider.js";
import { withRetry } from "../../shared/retry.js";

const responseSchema = z.object({
  clusters: z.array(
    z.object({
      clusterId: z.string(),
      summaryJa: z.string().min(1),
      tags: z.array(z.string()).max(3),
      reasonToRead: z.string().min(1)
    })
  )
});

export class GeminiProvider implements AIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gemini-2.0-flash"
  ) {}

  async enrich(clusters: Cluster[]): Promise<EnrichedCluster[]> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    const prompt = buildPrompt(clusters);
    const parsed = await withRetry(
      async () => {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json"
              },
              contents: [
                {
                  role: "user",
                  parts: [{ text: prompt }]
                }
              ]
            })
          }
        );

        if (!res.ok) {
          throw new Error(`gemini http error: ${res.status} ${await res.text()}`);
        }

        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const text = parts
          .map((part) => part.text ?? "")
          .join("\n")
          .trim();
        if (!text) {
          throw new Error("gemini empty response");
        }

        const json = parseJsonText(text);
        return responseSchema.parse(json);
      },
      2,
      600
    );

    return parsed.clusters.map((c) => ({
      clusterId: c.clusterId,
      summaryJa: c.summaryJa,
      tags: c.tags.filter((t) => (TAG_CANDIDATES as readonly string[]).includes(t)).slice(0, 3),
      reasonToRead: c.reasonToRead
    }));
  }
}

function buildPrompt(clusters: Cluster[]): string {
  const payload = clusters.map((c) => ({
    clusterId: c.id,
    title: c.title,
    trendScore: c.trendScore,
    deltaScore: c.deltaScore,
    deltaComments: c.deltaComments,
    links: c.items.slice(0, 3).map((i) => i.url),
    sources: [...new Set(c.items.map((i) => i.source))]
  }));

  return [
    "あなたはエンジニア向けトレンド編集者です。",
    "以下のクラスタ一覧を処理してください: 重複排除済み前提。",
    "各クラスタについて以下を返してください: summaryJa(日本語3-5行), tags(固定カテゴリから最大3), reasonToRead(1行)。",
    `tagsはこの候補のみ: ${TAG_CANDIDATES.join(", ")}`,
    "出力は厳密にJSONのみ。JSON以外の文字列を一切含めない。",
    "形式:",
    '{"clusters":[{"clusterId":"...","summaryJa":"...","tags":["..."],"reasonToRead":"..."}]}',
    "入力:",
    JSON.stringify(payload)
  ].join("\n");
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fenced) {
      return JSON.parse(fenced);
    }

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("gemini response is not valid JSON");
  }
}
