import { randomUUID } from "node:crypto";
import { runApp } from "../../app.js";

function bool(v: string | undefined, def = false): boolean {
  if (v == null) return def;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function int(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

async function main(): Promise<void> {
  const modeRaw = process.env.INPUT_MODE ?? process.env.MODE ?? "normal";
  const mode = modeRaw === "force" ? "force" : "normal";

  const dryRun = bool(process.env.INPUT_DRYRUN ?? process.env.DRY_RUN, false);
  const maxTopics = int(process.env.INPUT_MAXTOPICS ?? process.env.MAX_TOPICS, 17);
  const debug = bool(process.env.INPUT_DEBUG ?? process.env.DEBUG, false);

  await runApp({
    mode,
    dryRun,
    maxTopics,
    debug,
    runId: process.env.GITHUB_RUN_ID ?? randomUUID()
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
