import { afterEach, describe, expect, it, vi } from "vitest";
import { HackerNewsFetcher } from "../../../src/adapters/sources/hackerNewsFetcher.js";

describe("HackerNewsFetcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches top stories and maps item fields", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("topstories")) {
        return new Response(JSON.stringify([1001, 1002]), { status: 200 });
      }
      if (url.includes("1001")) {
        return new Response(
          JSON.stringify({ id: 1001, title: "Story", score: 33, descendants: 7, time: 1700000000 }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ id: 1002 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const items = await new HackerNewsFetcher().fetchItems();

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      source: "hackernews",
      id: "1001",
      title: "Story",
      score: 33,
      comments: 7
    });
    expect(items[0]?.url).toContain("news.ycombinator.com/item?id=1001");
  });
});
