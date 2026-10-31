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

/** One journaled migration: its file name, and the time drizzle records it under once applied. */
export type JournalEntry = { readonly tag: string; readonly when: number };

type Journal = { readonly entries: readonly JournalEntry[] };

/** The journaled migrations in `folder`, in the order the migrator applies them. */
export function journalEntries(folder: string = resolve(process.cwd(), "drizzle")): readonly JournalEntry[] {
  return (JSON.parse(readFileSync(resolve(folder, "meta/_journal.json"), "utf8")) as Journal).entries;
}

/**
 * The migrations one run of the migrator applied, by name, in journal order.
 * Drizzle's `migrate()` names none, but it records each one it applies as a
 * row of `drizzle.__drizzle_migrations` whose `created_at` is the entry's
 * `when`; `before` and `after` are those values read either side of the run.
 * A new row no journal entry matches is named by its `created_at`, so the
 * list never hides one.
 */
export function appliedMigrations(
  journal: readonly JournalEntry[],
  before: ReadonlySet<string>,
  after: ReadonlySet<string>,
): readonly string[] {
  const added = new Set([...after].filter((createdAt) => !before.has(createdAt)));
  const named = journal.filter(({ when }) => added.has(String(when)));
  for (const { when } of named) added.delete(String(when));
  return [...named.map(({ tag }) => tag), ...[...added].sort().map((createdAt) => `unjournaled migration recorded at ${createdAt}`)];
}

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
  const tables = new Map<TableName, Set<string>>();
  for (const { tag } of journalEntries(folder)) applyMigration(tables, readFileSync(resolve(folder, `${tag}.sql`), "utf8"));
  return tables;
}

/**
 * The statements in one migration that change or remove what already exists:
 * any DROP, any RENAME, an ALTER COLUMN … TYPE, and any UPDATE or DELETE.
 * Every preview build applies pending migrations to the shared preview
 * database, which holds real edits, so a migration meant to be additive only
 * must return none. `ON UPDATE` and `ON DELETE` inside a foreign key or a
 * trigger are not statements and are not counted.
 */
export function nonAdditiveStatements(sql: string): readonly string[] {
  return sql
    .replace(/--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim().replace(/\s+/g, " "))
    .filter(
      (statement) =>
        /^(UPDATE|DELETE)\b/i.test(statement) ||
        /\b(DROP|RENAME)\b/i.test(statement) ||
        /\bALTER\s+COLUMN\b.*\bTYPE\b/i.test(statement),
    );
}

/** The table and columns a single `insert into … (…) values` statement names. */
export function insertTarget(sql: string): { readonly table: TableName; readonly columns: readonly string[] } {
  const m = /^insert\s+into\s+((?:"\w+"\.)?"\w+")\s*\(([^)]*)\)\s+values/i.exec(sql);
  if (m === null) throw new Error(`not an insert with a column list: ${sql.slice(0, 80)}`);
  return { table: m[1], columns: [...m[2].matchAll(/"(\w+)"/g)].map(([, column]) => column) };
}
