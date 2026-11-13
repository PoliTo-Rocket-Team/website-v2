import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { and, eq, getTableColumns, sql, type Column, type Table } from "drizzle-orm";
import { getTableConfig, type PgColumn, type PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

// The database the server-side access tests run on (issue #649): a real
// Postgres engine in memory (PGlite) with every migration in drizzle/
// applied, so each loader, action and route runs its queries, constraints
// and triggers, the audit trigger included, as on the server. The stand-in
// for `@/db/client` (./fakes/db-client.ts) hands it out.
//
// Two test-only things sit beside the migrated schema, in a `test_journal`
// schema no migration knows: a journal of the writes the server's own
// statements made (a statement trigger on every table, so a refused call
// is shown to have written nothing), and copies of the tables a test
// restores between calls (`restore`).

const SCHEMAS = ["public", "better_auth"] as const;
const JOURNAL_OFF = "test_journal.off";

const client = new PGlite();

/** The batch running now, which the next one waits for. */
let batchRunning: Promise<unknown> = Promise.resolve();

/**
 * Runs a batch as one transaction, its statements in order, as the
 * neon-http driver sends `db.batch` in production (lib/db-audit.ts): the
 * PGlite driver has none of its own. A statement that fails rolls every
 * statement before it back. PGlite is one connection, so two batches sent
 * at once would share one transaction; each waits for the one before it to
 * end instead, as a second batch on Postgres waits for the row locks the
 * first one holds.
 */
function batch(queries: readonly PromiseLike<unknown>[]): Promise<unknown[]> {
  const run = batchRunning.then(async () => {
    await client.exec("begin");
    try {
      const results: unknown[] = [];
      for (const query of queries) results.push(await query);
      await client.exec("commit");
      return results;
    } catch (error) {
      await client.exec("rollback");
      throw error;
    }
  });
  batchRunning = run.catch(() => undefined);
  return run;
}

/** The Drizzle client the stand-in `getDb()` answers. */
export const testDb = Object.assign(drizzle(client, { schema }), { batch });

/** A write a server statement made: its kind (insert, update, delete, or a file store's) and its table (or the file's pathname). */
export type RecordedWrite = { readonly kind: string; readonly table: string };

type Relation = { readonly schema: string; readonly name: string };
type Serial = Relation & { readonly column: string; readonly sequence: string };

const quoted = (r: Relation) => `"${r.schema}"."${r.name}"`;

let ready: Promise<{ readonly tables: readonly Relation[]; readonly serials: readonly Serial[] }> | null = null;

/** Migrates the database once and puts the write journal on every table. */
function prepare() {
  ready ??= (async () => {
    await migrate(drizzle(client), { migrationsFolder: resolve(process.cwd(), "drizzle") });
    const { rows: tables } = await client.query<Relation>(
      `select table_schema as schema, table_name as name from information_schema.tables
       where table_schema = any($1) and table_type = 'BASE TABLE' order by 1, 2`,
      [SCHEMAS],
    );
    const { rows: serials } = await client.query<Serial>(
      `select n.nspname as schema, c.relname as name, a.attname as column,
         pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) as sequence
       from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = any($1) and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
         and pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) is not null`,
      [SCHEMAS],
    );
    // A statement trigger per event, since a transition table takes one
    // event: it notes the statement when it changed a row. A row a foreign
    // key's ON DELETE CASCADE removes is noted as a write of the statement
    // that caused it. A statement a trigger ran (the audit log row, the
    // users sync of drizzle/0001) is the database's own and is not noted;
    // neither is a test's own setup (JOURNAL_OFF).
    await client.exec(`
      create schema test_journal;
      create table test_journal.writes (id bigserial primary key, kind text not null, "table" text not null, tx bigint not null default txid_current());
      create function test_journal.note() returns trigger language plpgsql as $$
      begin
        if pg_trigger_depth() > 1 or current_setting('${JOURNAL_OFF}', true) = 'on' then return null; end if;
        if exists (select 1 from changed) then
          insert into test_journal.writes (kind, "table") values (lower(tg_op), tg_table_name);
        end if;
        return null;
      end $$;
      ${tables
        .flatMap((t) => [
          `create trigger test_journal_insert after insert on ${quoted(t)} referencing new table as changed for each statement execute function test_journal.note();`,
          `create trigger test_journal_update after update on ${quoted(t)} referencing new table as changed for each statement execute function test_journal.note();`,
          `create trigger test_journal_delete after delete on ${quoted(t)} referencing old table as changed for each statement execute function test_journal.note();`,
        ])
        .join("\n")}
    `);
    return { tables, serials };
  })();
  return ready;
}

// Restoring a state --------------------------------------------------------

/**
 * A state the database was in: the SQL that puts it back, the SQL that
 * answers whether nothing has changed it since (no write in the journal, every
 * id sequence where it was), and the newest audit log row then.
 */
type Kept = { readonly restore: string; readonly unchanged: string; readonly logMark: number };
const kept = new Map<string, Kept>();
let logMark = 0;
/** The state the database was last put in, until a test's own setup changes it. */
let standing: string | null = null;

async function newestLogId(): Promise<number> {
  const { rows } = await client.query<{ id: number | null }>(`select max(id)::int as id from public.logs`);
  return rows[0].id ?? 0;
}

/** The SQL that puts every table and sequence back as they stand now, with the copy it reads from made. */
async function keep(name: string): Promise<Kept> {
  const { tables, serials } = await prepare();
  const copy = `test_journal."${name}__%s"`;
  const copyOf = (t: Relation) => copy.replace("%s", `${t.schema}.${t.name}`);
  await client.exec(tables.map((t) => `create table ${copyOf(t)} as select * from ${quoted(t)};`).join("\n"));
  const sequences = [...new Set(serials.map((s) => s.sequence))];
  const values = sequences.length === 0 ? [] : (
    await client.query<{ sequence: string; value: string; called: boolean }>(
      sequences.map((s) => `select '${s}' as sequence, last_value::text as value, is_called as called from ${s}`).join(" union all "),
    )
  ).rows;
  const restore = [
    "set session_replication_role = replica;",
    `truncate ${tables.map(quoted).join(", ")};`,
    ...tables.map((t) => `insert into ${quoted(t)} overriding system value select * from ${copyOf(t)};`),
    ...values.map((v) => `select setval('${v.sequence}', ${v.value}, ${v.called});`),
    "set session_replication_role = default;",
    "truncate test_journal.writes;",
  ].join("\n");
  const unchanged = [
    "select not exists (select 1 from test_journal.writes)",
    ...values.map((v) => `(select last_value = ${v.value} and is_called = ${v.called} from ${v.sequence})`),
  ].join(" and ");
  return { restore, unchanged: `${unchanged} as unchanged`, logMark: await newestLogId() };
}

/**
 * Whether the database still stands as `state` left it. Every write the
 * server makes is in the journal, and an insert that rolled back still moved
 * its sequence, so an empty journal and unmoved sequences show nothing changed.
 */
async function stillStands(name: string, state: Kept): Promise<boolean> {
  if (standing !== name) return false;
  const { rows } = await client.query<{ unchanged: boolean }>(state.unchanged);
  return rows[0].unchanged;
}

/**
 * Puts the database in the state `build` leaves on a freshly migrated
 * database. The first call for a name runs `build` and keeps what it left;
 * every later call restores that, so each test starts from the same rows
 * and nothing a call before it wrote. The write journal starts empty. A
 * database that still stands as that state left it is not copied again.
 */
export async function restore(name: string, build: () => Promise<void>): Promise<void> {
  await prepare();
  let state = kept.get(name);
  if (state === undefined) {
    if (name !== MIGRATED) await resetDatabase();
    await build();
    state = await keep(name);
    kept.set(name, state);
  }
  if (!(await stillStands(name, state))) await client.exec(state.restore);
  standing = name;
  logMark = state.logMark;
}

const MIGRATED = "migrated";

/** The freshly migrated database: every migration's rows, nothing else. */
export function resetDatabase(): Promise<void> {
  return restore(MIGRATED, async () => {});
}

// A test's own rows --------------------------------------------------------

function relationOf(table: Table): Relation {
  const config = getTableConfig(table as PgTable);
  return { schema: config.schema ?? "public", name: config.name };
}

/** Moves each id sequence of the table past the ids its rows hold, as a seed would, so a write's new row gets a free id. */
async function syncSequences(table: Table): Promise<void> {
  const { serials } = await prepare();
  const relation = relationOf(table);
  for (const s of serials.filter((x) => x.schema === relation.schema && x.name === relation.name)) {
    await client.query(
      `select setval('${s.sequence}', m) from (select max("${s.column}") as m from ${quoted(s)}) x
       where m is not null and m >= (select last_value from ${s.sequence})`,
    );
  }
}

/** Runs a test's own setup write: the journal does not note it, and the audit log rows it makes are not the server's. */
async function setUp(table: Table, write: (tx: Parameters<Parameters<typeof testDb.transaction>[0]>[0]) => Promise<unknown>): Promise<void> {
  await prepare();
  standing = null;
  await testDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config(${JOURNAL_OFF}, 'on', true)`);
    await write(tx);
  });
  await syncSequences(table);
  logMark = await newestLogId();
}

/** Adds rows to a table, written with the schema's field names: a test's setup, never a write the journal notes. */
export async function addRows(table: Table, rows: readonly Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  await setUp(table, (tx) => tx.insert(table as PgTable).values(rows as never));
}

function matching(table: Table, match: Record<string, unknown>) {
  const columns = getTableColumns(table) as Record<string, Column>;
  return and(
    ...Object.entries(match).map(([field, value]) => {
      const column = columns[field];
      if (!column) throw new Error(`test database: ${relationOf(table).name} has no field ${field}`);
      return eq(column, value);
    }),
  );
}

/** Deletes every row of a table: a test's setup, for a test that starts from no rows where the migrations import some. */
export async function clearRows(table: Table): Promise<void> {
  await setUp(table, (tx) => tx.delete(table as PgTable));
}

/** Deletes the rows `match` picks, written with the schema's field names: a test's setup, never a write the journal notes. */
export async function removeRows(table: Table, match: Record<string, unknown>): Promise<void> {
  await setUp(table, (tx) => tx.delete(table as PgTable).where(matching(table, match)));
}

/** Changes the rows `match` picks, both written with the schema's field names: the way a test lays a value over a seeded row. */
export async function changeRows(table: Table, match: Record<string, unknown>, fields: Record<string, unknown>): Promise<void> {
  await setUp(table, (tx) => tx.update(table as PgTable).set(fields).where(matching(table, match)));
}

// Reading what a call left ---------------------------------------------------

/** The rows a table holds now, each with the schema's field names, in primary key order. */
export async function tableRows(table: Table): Promise<Record<string, unknown>[]> {
  await prepare();
  const columns = Object.values(getTableColumns(table) as Record<string, Column>);
  const config = getTableConfig(table as PgTable);
  const key = [...columns.filter((c) => c.primary), ...config.primaryKeys.flatMap((k) => k.columns)];
  return (await testDb.select().from(table as PgTable).orderBy(...((key.length > 0 ? key : columns) as PgColumn[]))) as Record<string, unknown>[];
}

/** The writes the server's statements made since the database was last restored, in order. */
export async function databaseWrites(): Promise<RecordedWrite[]> {
  const { rows } = await client.query<RecordedWrite>(`select kind, "table" from test_journal.writes order by id`);
  return rows.map(({ kind, table }) => ({ kind, table }));
}

/** The same writes, one list per transaction that committed them: what one batch wrote together. */
export async function writesByTransaction(): Promise<RecordedWrite[][]> {
  const { rows } = await client.query<RecordedWrite & { tx: string }>(`select kind, "table", tx::text as tx from test_journal.writes order by id`);
  const byTx = new Map<string, RecordedWrite[]>();
  for (const { kind, table, tx } of rows) byTx.set(tx, [...(byTx.get(tx) ?? []), { kind, table }]);
  return [...byTx.values()];
}

/** Notes a file store's upload or delete in the journal beside the database's writes (./fakes/files.ts, ./fakes/public-store.ts). */
export async function noteFileWrite(kind: string, pathname: string): Promise<void> {
  await prepare();
  await client.query(`insert into test_journal.writes (kind, "table") values ($1, $2)`, [kind, pathname]);
}

/** Who an audited write was logged under: what the audit trigger stored (drizzle/0061). */
export type LoggedWriter = { readonly userId: string | null; readonly actingAccountId: string | null };

/** The audit log rows stored since the database was last restored or a test laid its own rows, oldest first. */
export async function logRowsSinceSeed(): Promise<Record<string, unknown>[]> {
  return (await tableRows(schema.logs)).filter((row) => Number(row.id) > logMark);
}

/** Each writer the audit log rows since the last restore name, once, in the order first logged. */
export async function loggedWriters(): Promise<LoggedWriter[]> {
  const seen = new Map<string, LoggedWriter>();
  for (const row of await logRowsSinceSeed()) {
    const writer = { userId: (row.changedBy as string | null) ?? null, actingAccountId: (row.changedByActingAccount as string | null) ?? null };
    seen.set(JSON.stringify(writer), writer);
  }
  return [...seen.values()];
}
