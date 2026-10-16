import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TESTER_KEYS, TESTERS } from "../dev-tester";
import { baseline, BASELINE_AUTH_RESET, BASELINE_SQL_PATH, BASELINE_TABLES } from "../../db/seed/baseline";
import { SEED_MODULES } from "../../db/seed/registry";
import type { SeedTx } from "../../db/seed/tx";

const seedSql = readFileSync(BASELINE_SQL_PATH, "utf8");
const code = seedSql.replace(/--.*$/gm, "");

test("the registry runs the baseline module", () => {
  assert.ok(SEED_MODULES.includes(baseline));
});

test("every table db/seed.sql writes is one the baseline reset empties", () => {
  const written = [...code.matchAll(/\b(?:INSERT\s+INTO|UPDATE)\s+([a-z_."]+)/gi)].map((match) => match[1]);
  assert.ok(written.length > 0);
  for (const table of written) {
    if (table === 'better_auth."user"') continue;
    assert.ok((BASELINE_TABLES as readonly string[]).includes(table), `${table} is written but never reset`);
  }
});

test("every better_auth.user row the seed inserts is one the reset deletes", () => {
  const authRows = code.slice(code.indexOf('INSERT INTO better_auth."user"'));
  const rows = [...authRows.matchAll(/\('([0-9a-f-]{36})', '([^']+)'/g)];
  assert.equal(rows.length, TESTER_KEYS.length);
  for (const [, id, email] of rows) {
    assert.match(id, /^7e57e500-0000-4000-8000-00000000000.$/);
    assert.match(email, /\.tester@example\.com$/);
  }
  assert.ok(TESTER_KEYS.every((key) => rows.some(([, id]) => id === TESTERS[key].id)));
});

test("db/seed.sql only inserts fixed rows: no reset of its own, no clock, no randomness", () => {
  assert.doesNotMatch(code, /\b(TRUNCATE|DELETE|DROP)\b/i);
  assert.doesNotMatch(code, /(\bNOW\(\)|\bCURRENT_TIMESTAMP\b|\bCURRENT_DATE\b|\brandom\(\)|\bgen_random_uuid\(\))/i);
});

test("the reset deletes the testers' sign-in rows, then empties and renumbers every baseline table", async () => {
  const statements: string[] = [];
  const tx = { unsafe: async (query: string) => statements.push(query) } as unknown as SeedTx;
  await baseline.reset(tx);
  await baseline.insert(tx);
  assert.deepEqual(statements, [
    BASELINE_AUTH_RESET,
    `TRUNCATE ${BASELINE_TABLES.join(", ")} RESTART IDENTITY CASCADE`,
    seedSql,
  ]);
});
