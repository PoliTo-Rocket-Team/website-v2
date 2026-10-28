import { sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";

// A batch that must not land when something it read has changed since
// (issue #831). The neon-http driver runs a `db.batch` as one transaction
// (lib/db-audit.ts), but the batch cannot read and then decide: every
// statement runs. So the batch opens with a guard statement that fails the
// whole transaction when its condition is false at the moment it runs, and
// nothing after it is written. The failure is Postgres' division_by_zero,
// which no other statement these batches run can raise, so a caller reads
// it back with `isGuardFailure` and answers a refusal instead of an error.

type Db = ReturnType<typeof getDb>;

/** Postgres' "division_by_zero": the code a failed guard raises. */
const GUARD_FAILED = "22012";

/**
 * A batch statement that fails the batch unless `holds` is true when it runs.
 * `holds` must read a table: a condition with no table in it is folded when
 * the statement is planned, and would fail every batch.
 */
export function failUnless(db: Db, holds: SQL) {
  return db.execute(sql`select 1 / (case when ${holds} then 1 else 0 end) as "guard"`);
}

/** Whether `error` is a guard of `failUnless` that found its condition false. */
export function isGuardFailure(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === GUARD_FAILED) return true;
  }
  return false;
}

/** Some rows of one table: the table, its id column, and which rows (every one when `where` is undefined). */
export type RowSet = { readonly table: PgTable; readonly id: PgColumn; readonly where: SQL | undefined };

const idsOf = ({ table, id, where }: RowSet) => sql`select ${id} from ${table} ${where === undefined ? sql`` : sql`where ${where}`} order by ${id}`;

/** The ids of the rows, lowest first: what `unchangedRows` checks again later. */
export async function rowIds(rows: RowSet): Promise<number[]> {
  const read = await getDb().execute<Record<string, unknown>>(idsOf(rows));
  return read.rows.map((row) => Number(Object.values(row)[0]));
}

/**
 * A guard that fails the batch unless the rows are still exactly `ids`. A
 * write that replaces rows gives them new ids, so any write that landed on
 * them since `rowIds` read them fails it.
 */
export function unchangedRows(db: Db, rows: RowSet, ids: readonly number[]) {
  const then = sql`array[${sql.join(ids.map((i) => sql`${i}`), sql`, `)}]::integer[]`;
  return failUnless(db, sql`array(${idsOf(rows)}) = ${then}`);
}
