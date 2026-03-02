import { afterEach, describe, expect, it, vi } from "vitest";
import { ZennFetcher } from "../../../src/adapters/sources/zennFetcher.js";

describe("ZennFetcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses zenn rss and maps items", async () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title><![CDATA[Zenn Title]]></title><link>https://zenn.dev/a/articles/1</link><guid isPermaLink="true">https://zenn.dev/a/articles/1</guid><pubDate>Mon, 02 Mar 2026 01:02:43 GMT</pubDate></item></channel></rss>`;
    const fetchMock = vi.fn().mockResolvedValue(new Response(rss, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const items = await new ZennFetcher().fetchItems();

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      source: "zenn",
      id: "https://zenn.dev/a/articles/1",
      title: "Zenn Title",
      url: "https://zenn.dev/a/articles/1",
      comments: 0,
      score: 100
    });
  });
});
