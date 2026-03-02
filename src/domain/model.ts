export type SourceName = "hatena" | "hackernews" | "reddit" | "zenn";

export interface SourceItem {
  source: SourceName;
  id: string;
  title: string;
  url: string;
  score: number;
  comments: number;
  publishedAt: string;
  contentSnippet?: string;
  rawUrl?: string;
}

export interface ItemState {
  score: number;
  comments: number;
  lastSeen: string;
}

export interface AppState {
  lastRunJstDate?: string;
  itemsState: Record<string, ItemState>;
  postedHashes: Record<string, string>;
}

export interface ScoredItem extends SourceItem {
  ageHours: number;
  rankScore: number;
}

export interface Cluster {
  id: string;
  canonicalUrl: string;
  title: string;
  items: ScoredItem[];
  rankScore: number;
}

export interface EnrichedCluster {
  clusterId: string;
  summaryJa: string;
  tags: string[];
  reasonToRead: string;
  isImportant: boolean;
}

export interface RenderedSections {
  topTopics: Cluster[];
  rising: Cluster[];
  deepDiscussion: Cluster[];
}

export const DEFAULT_MAX_TOPICS = 17;
export const MAX_TOPICS_LIMIT = 30;
export const JST_TIMEZONE = "Asia/Tokyo";
export const ANCHOR_JST_DATE = "2026-03-02";

export const TAG_CANDIDATES = [
  "AI",
  "Web",
  "Backend",
  "Frontend",
  "Infra",
  "DevOps",
  "Security",
  "Cloud",
  "Data",
  "Mobile",
  "Tooling",
  "Architecture",
  "Testing",
  "Performance"
] as const;
