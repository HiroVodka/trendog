import { afterEach, describe, expect, it, vi } from "vitest";
import { HatenaFetcher } from "../../../src/adapters/sources/hatenaFetcher.js";

describe("HatenaFetcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps hatena hot entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { title: "A", link: "https://example.com/a", bookmarks: 12, date: "2026-03-01T00:00:00.000Z" }
        ]),
        { status: 200 }
      )
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
