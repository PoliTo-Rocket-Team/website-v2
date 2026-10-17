import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { is, SQL } from "drizzle-orm";
import { getTableConfig, PgDialect, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";
import { SEED_TRIGGERS } from "../../db/seed/audit";

// The same-rows rule (ADR 0016): a database default or trigger that reads the
// clock or a random source gives each run a different value. Every seed
// module writes typed rows, and ./modules.test.ts fails when one leaves such a
// column to its default; the tests below keep that check honest, and fail
// when a migration adds a trigger the seed does not handle.

const VOLATILE = /\b(now|clock_timestamp|statement_timestamp|transaction_timestamp|random|gen_random_uuid|uuid_generate_v\d)\s*\(|\b(current_timestamp|current_date|current_time|localtimestamp|localtime)\b/i;

function volatileDefaults(table: PgTable): string[] {
  const dialect = new PgDialect();
  return getTableConfig(table).columns
    .filter((column) => is(column.default, SQL) && VOLATILE.test(dialect.sqlToQuery(column.default).sql))
    .map((column) => column.name);
}

test("the check knows the clock defaults it guards", () => {
  assert.ok(volatileDefaults(schema.members).includes("nda_signed_at"));
  assert.ok(volatileDefaults(schema.users).includes("created_at"));
  assert.ok(volatileDefaults(schema.orders).includes("created_at"));
  assert.ok(volatileDefaults(schema.applications).includes("applied_at"));
  assert.ok(volatileDefaults(schema.partnerVersions).includes("updated_at"));
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
