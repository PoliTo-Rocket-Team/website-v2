import { editorVersion } from "@/lib/content/versioned";
import type { CheckedPhoto } from "@/lib/outreach-photos";
import type { PhotoSrc } from "@/lib/outreach-types";
import { afterWrite, FailedAfterUpload } from "./failure";
import { fingerprintOf, type Ledger, type LedgerEntry } from "./ledger";
import { buildPlan, planFiles, planImport, planKey, type Plan } from "./plan";
import { shapePhoto, storePhoto, type PhotoReader, type PhotoStore } from "./photos";
import { renderReport } from "./report";
import { readSnapshot, type ImportDb, type Snapshot } from "./snapshot";
import type { PostKey, Source } from "./source";
import { writePlan, type Written } from "./write";

// One run of the outreach Instagram import (issue #886), whatever opened the
// database and the store: the CLI (./cli.ts) on what the owner gives, the
// tests on the in-memory PGlite and a fake store. A dry run reads the source,
// the ledger, the photos and the database, and writes and uploads nothing. A
// real run plans, shapes every photo (one unfit photo stops it before any
// upload), uploads them, then re-reads the database and writes in one
// transaction, only while the plan still stands, so a failure leaves the
// database as it was. In that transaction it reads back each draft it wrote
// and fingerprints it for the ledger. Everything after the commit runs under
// `afterWrite`, so a failure there says the import was written.

export type RunOptions = {
  readonly mode: "dry-run" | "import";
  /** The source file's name, for the report. */
  readonly sourceFile: string;
  readonly source: Source;
  /** What earlier runs wrote; empty on the first run. */
  readonly ledger: Ledger;
  readonly photos: PhotoReader;
  readonly db: ImportDb;
  /** Where a real run uploads; a dry run needs none. */
  readonly store?: PhotoStore;
  /** Each upload's new file name; a UUID by default. */
  readonly newName?: () => string;
};

export type RunResult = {
  readonly plan: Plan;
  readonly written?: Written & { readonly uploaded: number };
  /** The ledger the caller keeps: the one given, with each key this run wrote at its new draft. */
  readonly ledger: Ledger;
  readonly report: string;
};

/** A step the caller runs once the run has its report: named, so a failure after a real run's commit says which step failed. */
export type FinishStep = { readonly name: string; readonly act: (result: RunResult) => unknown };

async function shapeAll(files: readonly string[], photos: PhotoReader): Promise<Map<string, CheckedPhoto | null>> {
  const shaped = new Map<string, CheckedPhoto | null>();
  for (const file of files) shaped.set(file, await shapePhoto(photos(file)));
  return shaped;
}

/** The ledger after a write: each key at the draft now stored on its post. */
function ledgerAfter(ledger: Ledger, postIds: ReadonlyMap<PostKey, number>, snapshot: Snapshot): Ledger {
  const next = new Map<PostKey, LedgerEntry>(ledger);
  for (const [key, postId] of postIds) {
    const item = snapshot.posts.find((p) => p.id === postId);
    if (item === undefined) throw new Error(`post ${postId} was written and is not stored`);
    next.set(key, { postId, fingerprint: fingerprintOf(editorVersion(item.version)) });
  }
  return next;
}

export async function runImport(options: RunOptions, finish: readonly FinishStep[] = []): Promise<RunResult> {
  const { mode, sourceFile, source, ledger, photos, db } = options;
  const plan = planImport(source, await readSnapshot(db), ledger);
  const shaped = await shapeAll(planFiles(plan), photos);
  const fitness = [...shaped].map(([file, photo]) => ({ file, fit: photo !== null }));

  if (mode === "dry-run") {
    const result = { plan, ledger, report: renderReport({ sourceFile, plan, photos: fitness }) };
    for (const step of finish) await step.act(result);
    return result;
  }

  const { store } = options;
  if (store === undefined) throw new Error("a real run needs the public store to upload the photos to");
  const unfit = fitness.filter((p) => !p.fit).map((p) => p.file);
  if (unfit.length > 0) throw new Error(`these photo files make no photo the store takes, so nothing was uploaded: ${unfit.join(", ")}`);
  const newName = options.newName ?? (() => crypto.randomUUID());

  const stored = new Map<string, PhotoSrc>();
  let written: Written;
  let nextLedger: Ledger;
  try {
    for (const [file, photo] of shaped) stored.set(file, await storePhoto(store, photo as CheckedPhoto, newName()));
    const srcOf = (file: string) => {
      const src = stored.get(file);
      if (src === undefined) throw new Error(`no photo was stored for ${file}`);
      return src;
    };
    ({ written, ledger: nextLedger } = await db.transaction(async (tx) => {
      const txDb = tx as unknown as ImportDb;
      const snapshot = await readSnapshot(txDb);
      // Each draft starts from the published version as this transaction reads it.
      const fresh = planImport(source, snapshot, ledger);
      if (planKey(fresh) !== planKey(plan)) throw new Error("the stored posts changed since the plan read them; run it again");
      const result = await writePlan(tx, buildPlan(fresh, snapshot, srcOf), snapshot.lastTagOrder);
      return { written: result.written, ledger: ledgerAfter(ledger, result.postIds, await readSnapshot(txDb)) };
    }));
  } catch (error) {
    throw stored.size === 0 ? error : new FailedAfterUpload(stored.size, error);
  }

  // The transaction has committed: from here on, every failure says the import was written.
  const all = { ...written, uploaded: stored.size };
  const report = await afterWrite("rendering the report", () => renderReport({ sourceFile, plan, photos: fitness, written: all }));
  const result = { plan, written: all, ledger: nextLedger, report };
  for (const step of finish) await afterWrite(step.name, () => step.act(result));
  return result;
}
