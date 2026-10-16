import assert from "node:assert/strict";
import { test } from "node:test";
import { getTableColumns, getTableName, is, SQL } from "drizzle-orm";
import { PgDialect, type PgTable } from "drizzle-orm/pg-core";
import { audit, AUDIT_CLEAR, AUDIT_RESET } from "../../db/seed/audit";
import { SEED_DATA } from "../../db/seed/cases";
import { SEED_MODULES } from "../../db/seed/registry";
import { resetTables, sequenceStatement, type TableSeed } from "../../db/seed/rows";
import type { SeedTx } from "../../db/seed/tx";
import { runSeed, type SeedConnection } from "./runner";
import { guardSeedTarget } from "./target";

// What a run sends, statement by statement, through a connection that records
// instead of writing.
type Sent = { readonly sql: string; readonly params: readonly unknown[] };

function recorder(sent: Sent[]): (url: string) => SeedConnection<SeedTx> {
  const tx = {
    unsafe: async (sql: string, params: unknown[] = []) => {
      sent.push({ sql, params: structuredClone(params) });
      return [];
    },
  } as unknown as SeedTx;
  return () => ({ transaction: (work) => work(tx), close: async () => {} });
}

async function seedOnce(): Promise<Sent[]> {
  const verdict = await guardSeedTarget("postgres://dev@localhost/prt", async () => undefined);
  assert.ok(verdict.ok);
  const sent: Sent[] = [];
  await runSeed(verdict.target, SEED_MODULES, recorder(sent));
  return sent;
}

const tableModules = SEED_MODULES.flatMap((m) => ("seed" in m ? [(m as typeof m & { seed: TableSeed }).seed] : []));

test("the registry runs every area module, people before the orders and applications that name them, and the audit clear last", () => {
  assert.deepEqual(
    SEED_MODULES.map((m) => m.name),
    ["structure", "people", "alumni", "access", "orders", "recruitment", "partners", "faq", "audit"],
  );
  assert.equal(SEED_MODULES.at(-1), audit);
});

test("every module but the audit clear writes typed rows", () => {
  assert.deepEqual(
    SEED_MODULES.filter((m) => !("seed" in m)).map((m) => m.name),
    ["audit"],
  );
});

test("running the seed twice sends the same statements with the same values", async () => {
  const first = await seedOnce();
  const second = await seedOnce();
  assert.ok(first.length > 0);
  assert.deepEqual(second, first);
});

test("every reset runs before any insert, so a second run starts from the same empty tables", async () => {
  const sent = await seedOnce();
  const isReset = (s: Sent) => /^(TRUNCATE|DELETE FROM better_auth)/.test(s.sql);
  const firstInsert = sent.findIndex((s) => !isReset(s));
  const lastReset = sent.findLastIndex(isReset);
  assert.ok(lastReset >= 0 && firstInsert === lastReset + 1);
  assert.equal(sent.at(-1)?.sql, AUDIT_CLEAR);
  assert.ok(sent.some((s) => s.sql === AUDIT_RESET));
});

test("the case checks read the very rows the modules insert", () => {
  const inserted = new Set<unknown>(tableModules.flatMap((seed) => seed.rows.map((set) => set.rows)));
  for (const [key, rows] of Object.entries(SEED_DATA)) assert.ok(inserted.has(rows), `SEED_DATA.${key} is not a list a module inserts`);
});

test("each typed module inserts only into tables its own reset clears", () => {
  for (const seed of tableModules) {
    const cleared = resetTables(seed);
    for (const set of seed.rows) assert.ok(cleared.includes(set.table), `${seed.name} writes ${getTableName(set.table)}`);
  }
});

test("no table is owned by two modules", () => {
  const owners = new Map<string, string>();
  for (const seed of tableModules) {
    for (const table of resetTables(seed)) {
      const name = getTableName(table);
      assert.equal(owners.get(name), undefined, `${name} is reset by ${owners.get(name)} and ${seed.name}`);
      owners.set(name, seed.name);
    }
  }
});

test("the people module removes only the testers' sign-in rows, never a developer's own account", () => {
  const people = tableModules.find((s) => s.name === "people");
  assert.ok(people);
  assert.deepEqual(people.owns.map(getTableName).sort(), ["members", "roles", "users"]);
  assert.match(people.keyed?.[0]?.reset.sql ?? "", /^DELETE FROM better_auth\."user" WHERE id LIKE '7e57e500-/);
});

// A database default or trigger that reads the clock or a random source gives
// each run a different value, so every typed row sets those columns itself.
const VOLATILE = /\b(now|clock_timestamp|statement_timestamp|transaction_timestamp|random|gen_random_uuid|uuid_generate_v\d)\s*\(|\b(current_timestamp|current_date|current_time|localtimestamp|localtime)\b/i;

function volatileKeys(table: PgTable): string[] {
  const dialect = new PgDialect();
  return Object.entries(getTableColumns(table))
    .filter(([, column]) => is(column.default, SQL) && VOLATILE.test(dialect.sqlToQuery(column.default).sql))
    .map(([key]) => key);
}

test("every typed row sets each column whose default reads the clock or a random source", () => {
  for (const seed of tableModules) {
    for (const set of seed.rows) {
      const keys = volatileKeys(set.table);
      for (const [index, row] of set.rows.entries()) {
        for (const key of keys) {
          assert.ok((row as Record<string, unknown>)[key] !== undefined, `${seed.name}: ${getTableName(set.table)} row ${index} leaves ${key} to its default`);
        }
      }
    }
  }
});

test("rows that set their own serial ids move the sequence past them", () => {
  const seeded = tableModules.flatMap((s) => s.rows).filter((set) => sequenceStatement(set) !== null);
  assert.deepEqual(seeded.map((set) => getTableName(set.table)).sort(), [
    "alumni_entries",
    "applications",
    "apply_positions",
    "departments",
    "divisions",
    "faqs",
    "interview_slots",
    "members",
    "orders",
    "partners",
  ]);
  for (const set of seeded) {
    const name = getTableName(set.table);
    assert.match(sequenceStatement(set)!.sql, new RegExp(`^SELECT setval\\(pg_get_serial_sequence\\('${name}', '[a-z_]+'\\)`));
  }
});
