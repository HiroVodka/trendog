import { z } from "zod";
import { Cluster, EnrichedCluster, TAG_CANDIDATES } from "../../domain/model.js";
import { AIProvider } from "../../ports/aiProvider.js";

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
    private readonly model: string = "gemini-flash-latest"
  ) {}

  async enrich(clusters: Cluster[]): Promise<EnrichedCluster[]> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    const prompt = buildPrompt(clusters);
    const models = unique([this.model, "gemini-2.0-flash", "gemini-1.5-flash"]);
    const errors: string[] = [];
    let parsed: z.infer<typeof responseSchema> | undefined;

    for (const model of models) {
      const result = await callModel(model, this.apiKey, prompt);
      if (result.ok) {
        parsed = result.value;
        break;
      }
      errors.push(`[${model}] ${result.error}`);
      if (!result.retryableAcrossModels) {
        break;
      }
    }

    if (!parsed) {
      throw new Error(`gemini enrich failed: ${errors.join(" | ")}`);
    }

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

async function callModel(
  model: string,
  apiKey: string,
  prompt: string
): Promise<
  | { ok: true; value: z.infer<typeof responseSchema> }
  | { ok: false; error: string; retryableAcrossModels: boolean }
> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey
        },
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

    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .map((part) => part.text ?? "")
        .join("\n")
        .trim();
      if (!text) {
        return { ok: false, error: "empty response text", retryableAcrossModels: true };
      }
      const json = parseJsonText(text);
      return { ok: true, value: responseSchema.parse(json) };
    }

    const body = await res.text();
    const parsedErr = parseGeminiError(body);
    const quotaZero = /limit:\s*0/i.test(body) || /PerDay/i.test(body);
    const retryDelayMs = parsedErr.retryDelayMs ?? 0;
    const retryable = res.status === 429 || res.status >= 500;

    if (retryable && attempt < 2 && !quotaZero) {
      const sleepMs = Math.max(800, Math.min(60000, retryDelayMs || 1000 * (attempt + 1)));
      await new Promise((r) => setTimeout(r, sleepMs));
      continue;
    }

    return {
      ok: false,
      error: `http ${res.status} ${parsedErr.message}`,
      retryableAcrossModels: res.status !== 401 && res.status !== 403
    };
  }

  return { ok: false, error: "unexpected retry loop exit", retryableAcrossModels: true };
}

function parseGeminiError(body: string): { message: string; retryDelayMs?: number } {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string; details?: Array<{ "@type"?: string; retryDelay?: string }> };
    };
    const message = json.error?.message ?? body.slice(0, 200);
    const retryDetail = json.error?.details?.find((x) => x?.["@type"]?.includes("RetryInfo"))?.retryDelay;
    const sec = retryDetail ? Number(retryDetail.replace(/[^\d.]/g, "")) : NaN;
    const retryDelayMs = Number.isFinite(sec) ? Math.floor(sec * 1000) : undefined;
    return { message, retryDelayMs };
  } catch {
    return { message: body.slice(0, 200) };
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
