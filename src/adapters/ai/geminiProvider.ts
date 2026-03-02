import { z } from "zod";
import { Cluster, EnrichedCluster, TAG_CANDIDATES } from "../../domain/model.js";
import { AIProvider } from "../../ports/aiProvider.js";

const responseSchema = z.object({
  clusters: z.array(
    z.object({
      clusterId: z.string(),
      isImportant: z.boolean(),
      reasonToRead: z.string().min(1)
    })
  )
});

const summarySchema = z.object({
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

  async enrich(clusters: Cluster[], audienceProfile: string): Promise<EnrichedCluster[]> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    const models = unique([this.model, "gemini-2.0-flash", "gemini-1.5-flash"]);
    const importance = await runAcrossModels(models, this.apiKey, buildImportancePrompt(clusters, audienceProfile), responseSchema);
    const importantIds = new Set(importance.clusters.filter((c) => c.isImportant).map((c) => c.clusterId));
    if (importantIds.size === 0) {
      return importance.clusters.map((c) => ({
        clusterId: c.clusterId,
        summaryJa: "",
        tags: [],
        reasonToRead: c.reasonToRead,
        isImportant: false
      }));
    }

    const importantClusters = clusters.filter((c) => importantIds.has(c.id));
    const summaries = await runAcrossModels(
      models,
      this.apiKey,
      buildSummaryPrompt(importantClusters, audienceProfile),
      summarySchema
    );
    const summaryMap = new Map(summaries.clusters.map((c) => [c.clusterId, c]));
    const reasonMap = new Map(importance.clusters.map((c) => [c.clusterId, c.reasonToRead]));

    return clusters.map((cluster) => {
      const sum = summaryMap.get(cluster.id);
      return {
        clusterId: cluster.id,
        summaryJa: sum?.summaryJa ?? "",
        tags: (sum?.tags ?? []).filter((t) => (TAG_CANDIDATES as readonly string[]).includes(t)).slice(0, 3),
        reasonToRead: sum?.reasonToRead ?? reasonMap.get(cluster.id) ?? "対象読者に関連するため",
        isImportant: importantIds.has(cluster.id)
      };
    });
  }
}

function buildImportancePrompt(clusters: Cluster[], audienceProfile: string): string {
  const payload = clusters.map((c) => ({
    clusterId: c.id,
    title: c.title,
    canonicalUrl: c.canonicalUrl,
    links: c.items.slice(0, 3).map((i) => i.url),
    sources: [...new Set(c.items.map((i) => i.source))]
  }));

  return [
    "あなたはエンジニア向けトレンド編集者です。",
    `対象読者: ${audienceProfile}`,
    "以下のクラスタ一覧を処理してください（重複排除済み）。",
    "各クラスタについて、対象読者に重要かを判定し、理由を1行で返してください。",
    "出力は厳密にJSONのみ。JSON以外の文字列を一切含めない。",
    "形式:",
    '{"clusters":[{"clusterId":"...","isImportant":true,"reasonToRead":"..."}]}',
    "入力:",
    JSON.stringify(payload)
  ].join("\n");
}

function buildSummaryPrompt(clusters: Cluster[], audienceProfile: string): string {
  const payload = clusters.map((c) => ({
    clusterId: c.id,
    title: c.title,
    canonicalUrl: c.canonicalUrl,
    links: c.items.slice(0, 3).map((i) => ({
      url: i.url,
      snippet: i.contentSnippet ?? ""
    })),
    sources: [...new Set(c.items.map((i) => i.source))]
  }));

  return [
    "あなたはエンジニア向けトレンド編集者です。",
    `対象読者: ${audienceProfile}`,
    "以下は重要だと判定済みの記事クラスタです。各クラスタを要約してください。",
    "各クラスタについて以下を返してください: summaryJa(日本語3-5行), tags(固定カテゴリから最大3), reasonToRead(対象読者視点で1行)。",
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
  prompt: string,
  schema: z.ZodTypeAny
): Promise<
  | { ok: true; value: any }
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
      return { ok: true, value: schema.parse(json) };
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

async function runAcrossModels<T extends z.ZodTypeAny>(
  models: string[],
  apiKey: string,
  prompt: string,
  schema: T
): Promise<z.infer<T>> {
  const errors: string[] = [];
  for (const model of models) {
    const result = await callModel(model, apiKey, prompt, schema);
    if (result.ok) {
      return result.value as z.infer<T>;
    }
    errors.push(`[${model}] ${result.error}`);
    if (!result.retryableAcrossModels) {
      break;
    }
  }
  throw new Error(`gemini enrich failed: ${errors.join(" | ")}`);
}
