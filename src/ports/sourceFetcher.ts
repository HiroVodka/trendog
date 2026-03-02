import { SourceItem } from "../domain/model.js";

export interface SourceFetcher {
  readonly name: string;
  fetchItems(nowIso: string): Promise<SourceItem[]>;
}
