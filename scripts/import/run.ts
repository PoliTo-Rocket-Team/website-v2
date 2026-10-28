import { planImport, type Plan } from "./plan";
import { photoUploads, preparePhotos, type PhotoStore } from "./photos";
import {
  planPositions,
  readPositionSnapshot,
  readPositionSources,
  renderPositionsReport,
  writePositions,
  type PositionPlan,
  type PositionSources,
} from "./positions";
import { renderReport } from "./report";
import { NO_DATABASE, readSnapshot, type ImportDb } from "./snapshot";
import { readSources, type Sources } from "./sources";
import type { Uploaded, Written } from "./write";
import { writePlan } from "./write";

// One run of the team data import (issue #677), whatever opened the database:
// the CLI (./cli.ts) on a connection the person running it gives, the tests on
// an in-memory PGlite. A dry run reads the database, if one is given, and
// writes and uploads nothing. An import reads, plans and writes in one
// transaction, so a failure leaves the database as it was. It uploads photos
// only when the run gives a photo store; without one the photos are counted
// as skipped and everything else is imported.

/** `today`: the day the run plans on (`YYYY-MM-DD`), the end of a seat handed over this year; by default the day it runs. */
export type RunOptions =
  | { readonly mode: "dry-run"; readonly directory: string; readonly year?: number; readonly db?: ImportDb; readonly today?: string }
  | { readonly mode: "import"; readonly directory: string; readonly year?: number; readonly db: ImportDb; readonly photoStore?: PhotoStore; readonly today?: string };

export type RunResult = {
  readonly sources: Sources;
  readonly plan: Plan;
  readonly written?: Written;
  readonly uploaded?: Uploaded;
  readonly report: string;
};

export async function runImport(options: RunOptions): Promise<RunResult> {
  const sources = readSources(options.directory, options.year);
  const folder = await preparePhotos(options.directory, sources);
  if (options.mode === "dry-run") {
    const snapshot = options.db === undefined ? NO_DATABASE : await readSnapshot(options.db);
    const plan = planImport(sources, snapshot, folder, options.today);
    return { sources, plan, report: renderReport({ mode: "dry-run", database: options.db !== undefined, sources, plan }) };
  }
  const uploads = options.photoStore === undefined ? null : photoUploads(options.photoStore);
  const { plan, written, uploaded } = await options.db.transaction(async (tx) => {
    const plan = planImport(sources, await readSnapshot(tx as unknown as ImportDb), folder, options.today);
    return { plan, ...(await writePlan(tx, plan, uploads)) };
  });
  return { sources, plan, written, uploaded, report: renderReport({ mode: "import", database: true, sources, plan, written, uploaded }) };
}

/** A positions-only run (issue #834; ./positions.ts). It maps to the database's divisions, so a dry run needs the database too. */
export type PositionsRunOptions = { readonly mode: "dry-run" | "import"; readonly directory: string; readonly db: ImportDb };

export type PositionsRunResult = {
  readonly sources: PositionSources;
  readonly plan: PositionPlan;
  /** How many positions an import inserted; absent on a dry run. */
  readonly written?: number;
  readonly report: string;
};

export async function runPositionsImport(options: PositionsRunOptions): Promise<PositionsRunResult> {
  const sources = readPositionSources(options.directory);
  if (options.mode === "dry-run") {
    const plan = planPositions(sources, await readPositionSnapshot(options.db));
    return { sources, plan, report: renderPositionsReport({ mode: "dry-run", sources, plan }) };
  }
  const { plan, written } = await options.db.transaction(async (tx) => {
    const plan = planPositions(sources, await readPositionSnapshot(tx as unknown as ImportDb));
    return { plan, written: await writePositions(tx, plan) };
  });
  return { sources, plan, written, report: renderPositionsReport({ mode: "import", sources, plan, written }) };
}
