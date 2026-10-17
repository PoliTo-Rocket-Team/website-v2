// The columns a database built only from the migration journal has (epic
// #260). Drizzle's migrator applies only the files `drizzle/meta/_journal.json`
// lists, so a `.sql` file without an entry never runs; a seed insert that names
// a column only such a file creates fails on the preview branch and on any
// fresh local database. This reads the journaled files in order and tracks
// each table's columns, so a test can check the seed against them.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** `"name"`, or `"schema"."name"` for a table outside `public`. */
export type TableName = string;

/** Each table the journal creates, with the columns it ends up with. */
export type JournaledSchema = ReadonlyMap<TableName, ReadonlySet<string>>;

type Journal = { readonly entries: readonly { readonly tag: string }[] };

const TABLE = String.raw`((?:"\w+"\.)?"\w+")`;

// One alternation, so the statements apply in file order.
const STATEMENT = new RegExp(
  [
    String.raw`CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${TABLE}\s*\(([\s\S]*?)\n\);`,
    String.raw`ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?${TABLE}\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"(\w+)"`,
    String.raw`ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?${TABLE}\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"(\w+)"`,
    String.raw`ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?${TABLE}\s+RENAME\s+COLUMN\s+"(\w+)"\s+TO\s+"(\w+)"`,
    String.raw`DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?${TABLE}`,
  ].join("|"),
  "gi",
);

/** Applies one migration's table statements to `tables`, in order. */
export function applyMigration(tables: Map<TableName, Set<string>>, sql: string): void {
  const text = sql.replace(/--.*$/gm, "");
  for (const m of text.matchAll(STATEMENT)) {
    const [, created, body, added, addedColumn, dropped, droppedColumn, renamed, from, to, droppedTable] = m;
    if (created !== undefined) {
      tables.set(created, new Set([...body.matchAll(/^\s*"(\w+)"/gm)].map(([, column]) => column)));
    } else if (added !== undefined) {
      tables.get(added)?.add(addedColumn);
    } else if (dropped !== undefined) {
      tables.get(dropped)?.delete(droppedColumn);
    } else if (renamed !== undefined) {
      const columns = tables.get(renamed);
      if (columns?.delete(from)) columns.add(to);
    } else if (droppedTable !== undefined) {
      tables.delete(droppedTable);
    }
  }
}

/** The schema the journaled migrations in `folder` build, read from the files. */
export function journaledSchema(folder: string = resolve(process.cwd(), "drizzle")): JournaledSchema {
  const journal = JSON.parse(readFileSync(resolve(folder, "meta/_journal.json"), "utf8")) as Journal;
  const tables = new Map<TableName, Set<string>>();
  for (const { tag } of journal.entries) applyMigration(tables, readFileSync(resolve(folder, `${tag}.sql`), "utf8"));
  return tables;
}

/** The table and columns a single `insert into … (…) values` statement names. */
export function insertTarget(sql: string): { readonly table: TableName; readonly columns: readonly string[] } {
  const m = /^insert\s+into\s+((?:"\w+"\.)?"\w+")\s*\(([^)]*)\)\s+values/i.exec(sql);
  if (m === null) throw new Error(`not an insert with a column list: ${sql.slice(0, 80)}`);
  return { table: m[1], columns: [...m[2].matchAll(/"(\w+)"/g)].map(([, column]) => column) };
}
