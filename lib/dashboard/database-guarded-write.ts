import "server-only";

import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db/client";
import { CHANGED_SINCE_READ } from "@/lib/content/editor";
import { sameVersions, type ContentItem, type Versioned } from "@/lib/content/versioned";
import { runAuditBatch } from "@/lib/db-audit";
import { isGuardFailure, rowIds, unchangedRows, type RowSet } from "@/lib/db-guard";
import { refused, written, type WriteResult } from "./write";

// A content item's versions rewritten only while they are still the ones
// the editor read (issue #831). Two saves of one item at once could each read
// it, and the second write would then put back a photo whose file the first
// one had just deleted. Each version write replaces the item's version rows,
// which gives them new ids: the ids are read first, then the item, which
// must still hold `expected`, and the batch opens with the table's guard lock
// and a guard that fails it when the rows are no longer those ids. Under the
// lock two such batches run one after the other, so exactly one of two such
// saves lands, and the other is refused with `CHANGED_SINCE_READ`.

type Db = ReturnType<typeof getDb>;

/** Where an item's version rows are: their table, its id column, and which rows are the item's. */
export type VersionRows = RowSet;

/** A guarded write that landed: the item as it stood before it, and what each of the batch's statements answered, in order. */
export type LandedWrite<T extends D, D> = { readonly before: ContentItem<T, D> | null; readonly results: readonly unknown[] };

/**
 * Runs `writes` in one audited batch behind the guard, when the item `read`
 * answers still holds `expected`; refused, with nothing written, when
 * another save landed first.
 */
export async function writeOverExpected<T extends D, D>(
  rows: VersionRows,
  read: () => Promise<ContentItem<T, D> | null>,
  expected: Versioned<T, D> | null,
  writes: (db: Db) => readonly BatchItem<"pg">[],
): Promise<WriteResult<LandedWrite<T, D>>> {
  const ids = await rowIds(rows);
  const before = await read();
  if (!sameVersions(before?.version ?? null, expected)) return refused(CHANGED_SINCE_READ);
  try {
    // The guard's two statements, the lock and the check, answer nothing the caller reads.
    const [, , ...results] = await runAuditBatch((db) => [...unchangedRows(db, rows, ids), ...writes(db)]);
    return written({ before, results });
  } catch (error) {
    if (isGuardFailure(error)) return refused(CHANGED_SINCE_READ);
    throw error;
  }
}
