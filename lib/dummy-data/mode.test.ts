import assert from "node:assert/strict";
import { test } from "node:test";
import { dummyDataOn } from "./mode";

const DB = "postgres://user@host/db";

test("production never reads dummy data, with or without a database", () => {
  for (const NODE_ENV of ["production", "development", undefined]) {
    assert.equal(dummyDataOn({ NODE_ENV, VERCEL_ENV: "production" }), false, `${NODE_ENV}, no database`);
    assert.equal(dummyDataOn({ NODE_ENV, VERCEL_ENV: "production", DATABASE_URL: DB }), false, `${NODE_ENV}, database`);
  }
  assert.equal(dummyDataOn({ NODE_ENV: "production" }), false, "local production build, no database");
  assert.equal(dummyDataOn({ NODE_ENV: "production", DATABASE_URL: DB }), false, "local production build, database");
});

test("a preview with its seeded database reads the database; a preview with none reads dummy data", () => {
  assert.equal(dummyDataOn({ NODE_ENV: "production", VERCEL_ENV: "preview", DATABASE_URL: DB }), false);
  assert.equal(dummyDataOn({ NODE_ENV: "production", VERCEL_ENV: "preview" }), true);
  assert.equal(dummyDataOn({ NODE_ENV: "production", VERCEL_ENV: "preview", DATABASE_URL: "" }), true);
});

test("next dev reads dummy data only with no database", () => {
  assert.equal(dummyDataOn({ NODE_ENV: "development" }), true);
  assert.equal(dummyDataOn({ NODE_ENV: "development", DATABASE_URL: DB }), false);
  assert.equal(dummyDataOn({ NODE_ENV: "development", VERCEL_ENV: "development" }), false);
  assert.equal(dummyDataOn({ NODE_ENV: "test" }), false);
});
