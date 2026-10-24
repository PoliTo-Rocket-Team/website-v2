import assert from "node:assert/strict";
import { test } from "node:test";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { assertDatabaseWhereRequired, DatabaseRequired } from "./database-required";

const DB = "postgres://user@host/db";

function stopped(env: Parameters<typeof assertDatabaseWhereRequired>[0]): DatabaseRequired {
  try {
    assertDatabaseWhereRequired(env);
  } catch (error) {
    assert.ok(error instanceof DatabaseRequired, `a DatabaseRequired, not ${String(error)}`);
    return error;
  }
  assert.fail("the run went on with no database");
}

test("next dev with no database stops, naming the Neon development branch", () => {
  for (const DATABASE_URL of [undefined, ""]) {
    const error = stopped({ NODE_ENV: "development", DATABASE_URL });
    assert.equal(error.database, "development");
    assert.match(error.message, /DATABASE_URL is not set/);
    assert.match(error.message, /Neon `development` branch/);
  }
});

test("a preview with no database stops, naming the shared preview branch", () => {
  for (const DATABASE_URL of [undefined, ""]) {
    const error = stopped({ NODE_ENV: "production", VERCEL_ENV: "preview", DATABASE_URL });
    assert.equal(error.database, "preview");
    assert.match(error.message, /DATABASE_URL is not set/);
    assert.match(error.message, /Neon `preview` branch/);
  }
});

test("next dev and a preview with a database go on", () => {
  assert.doesNotThrow(() => assertDatabaseWhereRequired({ NODE_ENV: "development", DATABASE_URL: DB }));
  assert.doesNotThrow(() => assertDatabaseWhereRequired({ NODE_ENV: "production", VERCEL_ENV: "preview", DATABASE_URL: DB }));
});

test("every page's database read stops there too: isDatabaseConfigured and getDb ask the rule (db/client.ts)", () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV, DATABASE_URL: process.env.DATABASE_URL };
  const env = process.env as Record<string, string | undefined>;
  const set = (next: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  };
  try {
    set({ NODE_ENV: "development", VERCEL_ENV: undefined, DATABASE_URL: undefined });
    assert.throws(() => isDatabaseConfigured(), DatabaseRequired);
    assert.throws(() => getDb(), /Neon `development` branch/);
    set({ NODE_ENV: "production", VERCEL_ENV: "preview" });
    assert.throws(() => isDatabaseConfigured(), /Neon `preview` branch/);
    set({ NODE_ENV: "production", VERCEL_ENV: "production" });
    assert.equal(isDatabaseConfigured(), false, "production with no database renders without one, as before");
    assert.throws(() => getDb(), /DATABASE_URL must be configured/);
  } finally {
    set(saved);
  }
});

test("production keeps running with or without a database, as it did", () => {
  for (const NODE_ENV of ["production", "development", undefined]) {
    assert.doesNotThrow(() => assertDatabaseWhereRequired({ NODE_ENV, VERCEL_ENV: "production" }), `${NODE_ENV}, no database`);
    assert.doesNotThrow(() => assertDatabaseWhereRequired({ NODE_ENV, VERCEL_ENV: "production", DATABASE_URL: DB }));
  }
  assert.doesNotThrow(() => assertDatabaseWhereRequired({ NODE_ENV: "production" }), "local production build");
  assert.doesNotThrow(() => assertDatabaseWhereRequired({ NODE_ENV: "development", VERCEL_ENV: "development" }), "Vercel development");
  assert.doesNotThrow(() => assertDatabaseWhereRequired({ NODE_ENV: "test" }), "the test runner");
});
