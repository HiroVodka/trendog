import { SourceItem } from "../../domain/model.js";
import { SourceFetcher } from "../../ports/sourceFetcher.js";
import { fetchJsonWithRetry } from "../../shared/http.js";

const DEFAULT_SUBREDDITS = [
  "webdev",
  "javascript",
  "typescript",
  "reactjs",
  "golang",
  "rust",
  "python",
  "java",
  "devops",
  "sre",
  "kubernetes",
  "aws",
  "netsec",
  "softwarearchitecture",
  "programming",
  "experienceddevs"
];

interface RedditChild {
  data: {
    id: string;
    title: string;
    permalink: string;
    score: number;
    num_comments: number;
    created_utc: number;
  };
}

interface RedditListing {
  data: {
    children: RedditChild[];
  };
}

interface RedditAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface RedditOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export class RedditFetcher implements SourceFetcher {
  readonly name = "reddit";
  private accessToken?: string;
  private accessTokenExpiresAt = 0;

  constructor(
    private readonly userAgent: string,
    private readonly subreddits: string[] = DEFAULT_SUBREDDITS,
    private readonly oauth?: RedditOAuthConfig
  ) {}

  async fetchItems(): Promise<SourceItem[]> {
    const modes = ["rising", "hot", "top?t=day"];
    const all: SourceItem[] = [];

    for (const subreddit of this.subreddits) {
      for (const mode of modes) {
        const data = await this.fetchListing(subreddit, mode);
        for (const child of data.data.children ?? []) {
          all.push({
            source: "reddit",
            id: `${subreddit}:${child.data.id}`,
            title: child.data.title,
            url: `https://www.reddit.com${child.data.permalink}`,
            score: child.data.score,
            comments: child.data.num_comments,
            publishedAt: new Date(child.data.created_utc * 1000).toISOString()
          });
        }
      }
    }

    const uniq = new Map<string, SourceItem>();
    for (const item of all) {
      const existing = uniq.get(item.id);
      if (!existing || item.score + item.comments > existing.score + existing.comments) {
        uniq.set(item.id, item);
      }
    }

    return [...uniq.values()];
  }

  private async fetchListing(subreddit: string, mode: string): Promise<RedditListing> {
    if (this.oauth?.clientId && this.oauth?.clientSecret) {
      const token = await this.getAccessToken();
      return fetchJsonWithRetry<RedditListing>(
        `https://oauth.reddit.com/r/${subreddit}/${mode}?limit=15&raw_json=1`,
        {
          headers: {
            "User-Agent": this.userAgent,
            Accept: "application/json",
            Authorization: `Bearer ${token}`
          }
        }
      );
    }

    return fetchJsonWithRetry<RedditListing>(
      `https://api.reddit.com/r/${subreddit}/${mode}?limit=15&raw_json=1`,
      {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json"
        }
      }
    );
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.accessTokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const basic = Buffer.from(`${this.oauth?.clientId}:${this.oauth?.clientSecret}`, "utf8").toString("base64");
    const body = new URLSearchParams({ grant_type: "client_credentials" }).toString();
    const token = await fetchJsonWithRetry<RedditAccessTokenResponse>("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": this.userAgent
      },
      body
    });

    this.accessToken = token.access_token;
    this.accessTokenExpiresAt = now + token.expires_in * 1000;
    return token.access_token;
  }
}
