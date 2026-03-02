import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { AppState } from "../../domain/model.js";
import { StateStore } from "../../ports/stateStore.js";

const schema = z.object({
  lastRunJstDate: z.string().optional(),
  itemsState: z.record(
    z.object({
      score: z.number(),
      comments: z.number(),
      lastSeen: z.string()
    })
  ),
  postedHashes: z.record(z.string())
});

export class FileStateStore implements StateStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<AppState> {
    try {
      const body = await readFile(this.filePath, "utf8");
      return schema.parse(JSON.parse(body));
    } catch {
      return {
        itemsState: {},
        postedHashes: {}
      };
    }
  }

  async save(state: AppState): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
  }
}
