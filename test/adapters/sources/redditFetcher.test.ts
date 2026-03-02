import { afterEach, describe, expect, it, vi } from "vitest";
import { RedditFetcher } from "../../../src/adapters/sources/redditFetcher.js";

describe("RedditFetcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches multiple modes, sets user-agent, and deduplicates by strongest score", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers["User-Agent"]).toBe("trendog-test/1.0");

      const body = {
        data: {
          children: [
            {
              data: {
                id: "abc",
                title: "Post",
                permalink: "/r/golang/comments/abc/post",
                score: _url.includes("rising") ? 10 : 20,
                num_comments: _url.includes("rising") ? 1 : 2,
                created_utc: 1700000000
              }
            }
          ]
        }
      };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const fetcher = new RedditFetcher("trendog-test/1.0", ["golang"]);
    const items = await fetcher.fetchItems();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      source: "reddit",
      id: "golang:abc",
      score: 20,
      comments: 2
    });
  });

  it("uses oauth.reddit.com when oauth credentials are provided", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/v1/access_token")) {
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toContain("Basic ");
        return new Response(
          JSON.stringify({
            access_token: "token-123",
            token_type: "bearer",
            expires_in: 3600
          }),
          { status: 200 }
        );
      }

      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer token-123");
      return new Response(
        JSON.stringify({
          data: {
            children: [
              {
                data: {
                  id: "xyz",
                  title: "Oauth Post",
                  permalink: "/r/golang/comments/xyz/oauth_post",
                  score: 9,
                  num_comments: 4,
                  created_utc: 1700000000
                }
              }
            ]
          }
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const fetcher = new RedditFetcher("trendog-test/1.0", ["golang"], {
      clientId: "cid",
      clientSecret: "csecret"
    });
    const items = await fetcher.fetchItems();

    expect(items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("www.reddit.com/api/v1/access_token");
    expect(urls[1]).toContain("oauth.reddit.com/r/golang/rising");
  });
});
