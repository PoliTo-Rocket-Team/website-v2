import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { TESTER_KEYS, TESTERS, isTesterKey, testerSignInOn } from "./dev-tester";

test("tester sign-in is on only for next dev with no VERCEL_ENV", () => {
  assert.equal(testerSignInOn({ NODE_ENV: "development" }), true);
  assert.equal(testerSignInOn({ NODE_ENV: "development", VERCEL_ENV: "" }), true);
});

test("tester sign-in is off for production and test builds", () => {
  for (const NODE_ENV of ["production", "test", undefined, "", "Development"]) {
    assert.equal(testerSignInOn({ NODE_ENV }), false, String(NODE_ENV));
  }
});

test("tester sign-in is off on every Vercel deploy, whatever NODE_ENV says", () => {
  for (const VERCEL_ENV of ["preview", "production", "development"]) {
    for (const NODE_ENV of ["development", "production", "test"]) {
      assert.equal(testerSignInOn({ NODE_ENV, VERCEL_ENV }), false, `${NODE_ENV}/${VERCEL_ENV}`);
    }
  }
});

test("the gate is off under this test runner", () => {
  assert.equal(testerSignInOn(), false);
});

test("every tester key names a tester with its own id and email", () => {
  assert.deepEqual(Object.keys(TESTERS).sort(), [...TESTER_KEYS].sort());
  for (const key of TESTER_KEYS) assert.equal(TESTERS[key].key, key);
  assert.equal(new Set(TESTER_KEYS.map((key) => TESTERS[key].id)).size, TESTER_KEYS.length);
  assert.equal(new Set(TESTER_KEYS.map((key) => TESTERS[key].email)).size, TESTER_KEYS.length);
  assert.equal(isTesterKey("operations-lead"), true);
  assert.equal(isTesterKey("admin"), false);
});

test("db/seed.sql seeds every tester in better_auth.user and public.users", () => {
  const seed = readFileSync(resolve(process.cwd(), "db/seed.sql"), "utf8");
  const authInsert = seed.indexOf('INSERT INTO better_auth."user"');
  assert.notEqual(authInsert, -1);
  const publicUsers = seed.slice(0, authInsert);
  const authUsers = seed.slice(authInsert);
  for (const key of TESTER_KEYS) {
    const { id, email } = TESTERS[key];
    const row = `'${id}', '${email}'`;
    assert.ok(publicUsers.includes(`(${row}`), `public.users row for ${key}`);
    assert.ok(authUsers.includes(`(${row}`), `better_auth.user row for ${key}`);
  }
});
