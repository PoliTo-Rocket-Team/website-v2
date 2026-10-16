import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { is, SQL } from "drizzle-orm";
import { getTableConfig, PgDialect, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";
import { SEED_TRIGGERS } from "../../db/seed/audit";
import { baseline, BASELINE_SQL_PATH, BASELINE_TABLES } from "../../db/seed/baseline";
import type { SeedTx } from "../../db/seed/tx";

const seedSql = readFileSync(BASELINE_SQL_PATH, "utf8");
const code = seedSql.replace(/--.*$/gm, "");

test("every table db/seed.sql writes is one the baseline reset empties", () => {
  const written = [...code.matchAll(/\b(?:INSERT\s+INTO|UPDATE)\s+([a-z_."]+)/gi)].map((match) => match[1]);
  assert.ok(written.length > 0);
  for (const table of written) {
    assert.ok((BASELINE_TABLES as readonly string[]).includes(table), `${table} is written but never reset`);
  }
});

test("db/seed.sql only inserts fixed rows: no reset of its own, no clock, no randomness", () => {
  assert.doesNotMatch(code, /\b(TRUNCATE|DELETE|DROP)\b/i);
  assert.doesNotMatch(code, /(\bNOW\(\)|\bCURRENT_TIMESTAMP\b|\bCURRENT_DATE\b|\brandom\(\)|\bgen_random_uuid\(\))/i);
});

test("the reset empties and renumbers every baseline table, then the insert runs db/seed.sql", async () => {
  const statements: string[] = [];
  const tx = { unsafe: async (query: string) => statements.push(query) } as unknown as SeedTx;
  await baseline.reset(tx);
  await baseline.insert(tx);
  assert.deepEqual(statements, [`TRUNCATE ${BASELINE_TABLES.join(", ")} RESTART IDENTITY CASCADE`, seedSql]);
});

// A database default or trigger that reads the clock or a random source gives
// each run a different value. The tests below read the schema and the
// migrations, so a new such column or trigger fails here before it reaches a
// second seed run.

const VOLATILE = /\b(now|clock_timestamp|statement_timestamp|transaction_timestamp|random|gen_random_uuid|uuid_generate_v\d)\s*\(|\b(current_timestamp|current_date|current_time|localtimestamp|localtime)\b/i;

function volatileDefaults(table: PgTable): string[] {
  const dialect = new PgDialect();
  return getTableConfig(table).columns
    .filter((column) => is(column.default, SQL) && VOLATILE.test(dialect.sqlToQuery(column.default).sql))
    .map((column) => column.name);
}

const tablesByName = new Map(
  (Object.values(schema) as unknown[])
    .flatMap((value) => (is(value, PgTable) ? [value] : []))
    .map((table) => {
      const { name, schema: owner } = getTableConfig(table);
      return [owner ? `${owner}."${name}"` : name, table] as const;
    }),
);

test("every insert in db/seed.sql sets each column whose default reads the clock or a random source", () => {
  const inserts = [...code.matchAll(/\bINSERT\s+INTO\s+([a-z_."]+)\s*\(([^)]*)\)/gi)];
  assert.ok(inserts.length > 0);
  for (const [, tableName, columnList] of inserts) {
    const table = tablesByName.get(tableName);
    assert.ok(table, `${tableName} is not a table in db/schema`);
    const listed = columnList.split(",").map((column) => column.trim().replace(/"/g, ""));
    for (const column of volatileDefaults(table)) {
      assert.ok(listed.includes(column), `an insert into ${tableName} leaves ${column} to its clock or random default`);
    }
  }
});

test("the check knows the clock defaults it guards", () => {
  assert.ok(volatileDefaults(schema.members).includes("nda_signed_at"));
  assert.ok(volatileDefaults(schema.users).includes("created_at"));
  assert.ok(volatileDefaults(schema.orders).includes("created_at"));
  assert.ok(volatileDefaults(schema.logs).includes("changed_at"));
});

function liveTriggers(): Set<string> {
  const folder = resolve(process.cwd(), "drizzle");
  const live = new Set<string>();
  for (const file of readdirSync(folder).filter((name) => name.endsWith(".sql")).sort()) {
    const migration = readFileSync(resolve(folder, file), "utf8").replace(/--.*$/gm, "");
    // In file order, so a migration that drops and re-creates a trigger keeps it.
    for (const [, verb, name] of migration.matchAll(/\b(CREATE|DROP)\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+(?:IF\s+EXISTS\s+)?"?([a-z_]+)"?/gi)) {
      if (verb.toUpperCase() === "CREATE") live.add(name);
      else live.delete(name);
    }
  }
  return live;
}

test("every trigger the migrations leave is one the seed handles", () => {
  assert.deepEqual([...liveTriggers()].sort(), Object.keys(SEED_TRIGGERS).sort());
});
