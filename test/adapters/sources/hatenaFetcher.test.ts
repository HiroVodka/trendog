import { afterEach, describe, expect, it, vi } from "vitest";
import { HatenaFetcher } from "../../../src/adapters/sources/hatenaFetcher.js";

describe("HatenaFetcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps hatena hot entries", async () => {
    const rss = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<rdf:RDF>\n<channel></channel>\n<item rdf:about=\"https://example.com/a\">\n<title>A</title>\n<link>https://example.com/a</link>\n<hatena:bookmarkcount>12</hatena:bookmarkcount>\n<dc:date>2026-03-01T00:00:00.000Z</dc:date>\n</item>\n</rdf:RDF>`;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(rss, { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const items = await new HatenaFetcher().fetchItems();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      source: "hatena",
      id: "1",
      title: "A",
      url: "https://example.com/a",
      score: 12,
      comments: 0
    });
  });
});
