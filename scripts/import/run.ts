import { planImport, type Plan } from "./plan";
import { renderReport } from "./report";
import { NO_DATABASE, readSnapshot, type ImportDb } from "./snapshot";
import { readSources, type Sources } from "./sources";
import type { Written } from "./write";
import { writePlan } from "./write";

// One run of the team data import (issue #677), whatever opened the database:
// the CLI (./cli.ts) on a connection the person running it gives, the tests on
// an in-memory PGlite. A dry run reads the database, if one is given, and
// writes nothing. An import reads, plans and writes in one transaction, so a
// failure leaves the database as it was.

export type RunOptions =
  | { readonly mode: "dry-run"; readonly directory: string; readonly year?: number; readonly db?: ImportDb }
  | { readonly mode: "import"; readonly directory: string; readonly year?: number; readonly db: ImportDb };

export type RunResult = { readonly sources: Sources; readonly plan: Plan; readonly written?: Written; readonly report: string };

export async function runImport(options: RunOptions): Promise<RunResult> {
  const sources = readSources(options.directory, options.year);
  if (options.mode === "dry-run") {
    const snapshot = options.db === undefined ? NO_DATABASE : await readSnapshot(options.db);
    const plan = planImport(sources, snapshot);
    return { sources, plan, report: renderReport({ mode: "dry-run", database: options.db !== undefined, sources, plan }) };
  }
  const { plan, written } = await options.db.transaction(async (tx) => {
    const plan = planImport(sources, await readSnapshot(tx as unknown as ImportDb));
    return { plan, written: await writePlan(tx, plan) };
  });
  return { sources, plan, written, report: renderReport({ mode: "import", database: true, sources, plan, written }) };
}
