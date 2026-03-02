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

export class RedditFetcher implements SourceFetcher {
  readonly name = "reddit";

  constructor(private readonly userAgent: string, private readonly subreddits: string[] = DEFAULT_SUBREDDITS) {}

  async fetchItems(): Promise<SourceItem[]> {
    const modes = ["rising", "hot", "top?t=day"];
    const all: SourceItem[] = [];

    for (const subreddit of this.subreddits) {
      for (const mode of modes) {
        const url = `https://www.reddit.com/r/${subreddit}/${mode}.json?limit=15`;
        const data = await fetchJsonWithRetry<RedditListing>(url, {
          headers: {
            "User-Agent": this.userAgent
          }
        });
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
}
