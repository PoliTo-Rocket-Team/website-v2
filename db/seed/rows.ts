// Typed seed rows (epic #260). An area module lists its rows as the schema's
// own insert types, so a row with a missing required column or a wrong value
// does not compile. This file turns those lists into the statements a module
// runs: one insert per table, a reset that empties the tables the module
// owns, and a sequence fix after rows that set their own serial ids.

import { getTableColumns, getTableName, type InferInsertModel } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import type { SeedModule } from "@/lib/seed/runner";
import type { SeedTx } from "./tx";

/** The rows one module inserts into one table, in insert order. */
export type SeedRows<T extends PgTable = PgTable> = {
  readonly table: T;
  readonly rows: readonly InferInsertModel<T>[];
};

export function rowsOf<T extends PgTable>(table: T, rows: readonly InferInsertModel<T>[]): SeedRows<T> {
  return { table, rows };
}

/** One SQL statement and its parameters, as the module sends it. */
export type SeedStatement = { readonly sql: string; readonly params: readonly unknown[] };

// Builds SQL with the schema's column names and value mapping; never connects.
const builder = drizzle.mock();

/** `"name"`, or `"schema"."name"` for a table outside `public`. */
export function qualifiedName(table: PgTable): string {
  const { name, schema } = getTableConfig(table);
  return schema ? `"${schema}"."${name}"` : `"${name}"`;
}

export function insertStatement(set: SeedRows): SeedStatement {
  if (set.rows.length === 0) throw new Error(`no rows to insert into ${getTableName(set.table)}`);
  const { sql, params } = builder.insert(set.table).values([...set.rows]).toSQL();
  return { sql, params };
}

/**
 * Empties the tables and restarts their ids. CASCADE also empties every table
 * that points at them; the runner resets every module before any inserts, so
 * that only empties rows a later module's reset would remove anyway.
 */
export function truncateStatement(tables: readonly PgTable[]): SeedStatement {
  return { sql: `TRUNCATE ${tables.map(qualifiedName).join(", ")} RESTART IDENTITY CASCADE`, params: [] };
}

/**
 * Rows that set a serial id themselves leave its sequence behind, so the
 * app's next insert would take an id already used. This moves the sequence to
 * the highest id seeded; null when the rows leave every serial id to it.
 */
export function sequenceStatement(set: SeedRows): SeedStatement | null {
  const columns = Object.entries(getTableColumns(set.table));
  const serial = columns.find(([, column]) => column.columnType === "PgSerial");
  if (serial === undefined) return null;
  const [key, column] = serial;
  if (!set.rows.some((row) => (row as Record<string, unknown>)[key] !== undefined)) return null;
  const table = getTableName(set.table);
  return {
    sql: `SELECT setval(pg_get_serial_sequence('${table}', '${column.name}'), (SELECT max("${column.name}") FROM ${qualifiedName(set.table)}))`,
    params: [],
  };
}

/** A table that also holds rows the seed must keep: the reset deletes only the module's own. */
export type KeyedTable = { readonly table: PgTable; readonly reset: SeedStatement };

/** One area's seed: the tables it owns and empties, and the rows it puts back. */
export type TableSeed = {
  readonly name: string;
  /** Tables only the seed fills: the reset empties them. */
  readonly owns: readonly PgTable[];
  /** Tables shared with rows the seed keeps, such as a developer's own sign-in. */
  readonly keyed?: readonly KeyedTable[];
  readonly rows: readonly SeedRows[];
  /** Statements run after the rows are in (undoing what a trigger changed). */
  readonly afterInsert?: readonly SeedStatement[];
};

/** Every table the module's reset clears its rows from. */
export function resetTables(seed: TableSeed): PgTable[] {
  return [...seed.owns, ...(seed.keyed ?? []).map((k) => k.table)];
}

export function resetStatements(seed: TableSeed): SeedStatement[] {
  return [...(seed.keyed ?? []).map((k) => k.reset), truncateStatement(seed.owns)];
}

export function insertStatements(seed: TableSeed): SeedStatement[] {
  return [
    ...seed.rows.flatMap((set) => {
      const sequence = sequenceStatement(set);
      return sequence === null ? [insertStatement(set)] : [insertStatement(set), sequence];
    }),
    ...(seed.afterInsert ?? []),
  ];
}

/** Sends one statement through the seed's transaction. */
export async function runStatement(tx: SeedTx, sql: string, params: readonly unknown[]): Promise<void> {
  await tx.unsafe(sql, params as never[]);
}

async function run(tx: SeedTx, statements: readonly SeedStatement[]): Promise<void> {
  for (const { sql, params } of statements) await runStatement(tx, sql, params);
}

export function tableSeedModule(seed: TableSeed): SeedModule<SeedTx> & { readonly seed: TableSeed } {
  const cleared = resetTables(seed);
  for (const set of seed.rows) {
    if (!cleared.includes(set.table)) {
      throw new Error(`seed module "${seed.name}" inserts into ${getTableName(set.table)}, which its reset does not clear`);
    }
  }
  return {
    name: seed.name,
    seed,
    reset: (tx) => run(tx, resetStatements(seed)),
    insert: (tx) => run(tx, insertStatements(seed)),
  };
}
