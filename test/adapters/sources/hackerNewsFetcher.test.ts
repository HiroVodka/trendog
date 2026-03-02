import { afterEach, describe, expect, it, vi } from "vitest";
import { HackerNewsFetcher } from "../../../src/adapters/sources/hackerNewsFetcher.js";

describe("HackerNewsFetcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prioritizes ask/show stories and keeps all mapped items", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("askstories")) {
        return new Response(JSON.stringify([1001]), { status: 200 });
      }
      if (url.includes("showstories")) {
        return new Response(JSON.stringify([1002]), { status: 200 });
      }
      if (url.includes("topstories")) {
        return new Response(JSON.stringify([1003]), { status: 200 });
      }
      if (url.includes("1001")) {
        return new Response(
          JSON.stringify({ id: 1001, title: "Ask HN: Best Rails tools", text: "<p>backend details</p>", score: 33, descendants: 7, time: 1700000000 }),
          { status: 200 }
        );
      }
      if (url.includes("1002")) {
        return new Response(
          JSON.stringify({ id: 1002, title: "Show HN: JavaScript linter", score: 22, descendants: 3, time: 1700000100 }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({ id: 1003, title: "Completely unrelated topic", score: 99, descendants: 1, time: 1700000200 }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const items = await new HackerNewsFetcher().fetchItems();

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      source: "hackernews",
      id: "1001",
      title: "Ask HN: Best Rails tools",
      score: 33,
      comments: 7
    });
    expect(items[0]?.contentSnippet).toContain("backend details");
    expect(items[1]).toMatchObject({
      source: "hackernews",
      id: "1002",
      title: "Show HN: JavaScript linter",
      score: 22,
      comments: 3
    });
    expect(items[2]).toMatchObject({
      source: "hackernews",
      id: "1003",
      title: "Completely unrelated topic"
    });
  });
});
