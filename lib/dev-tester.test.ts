import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { VIEWER_KINDS } from "./dashboard/viewer";
import { TESTER_KEYS, TESTERS, isTesterKey, testerSignInOn } from "./dev-tester";
import { testDeveloperSignIn } from "./test-developer";

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

test("both sign-ins offer a department head (issue #230)", () => {
  assert.equal(isTesterKey("department-head"), true);
  assert.equal(TESTERS["department-head"].email, "department-head.tester@example.com");
  // The preview's test developer sign-in lists every viewer kind, the department head among them.
  assert.ok(VIEWER_KINDS.includes("department-head"));
  const signIn = testDeveloperSignIn(new URL("https://preview.example/api/test-developer/sign-in?viewer=department-head"), {
    VERCEL_ENV: "preview",
  });
  assert.equal(signIn.status, 303);
  assert.match(signIn.headers.get("Set-Cookie") ?? "", /prt_test_developer=department-head;/);
});

test("db/seed.sql seeds the department head tester with a head role in Aerodynamics and no scope row", () => {
  const seed = readFileSync(resolve(process.cwd(), "db/seed.sql"), "utf8");
  assert.ok(seed.includes("(904, (SELECT id FROM departments WHERE code = 'AER'), NULL, 'Head of Aerodynamics', '2025-10-01'::date, NULL, 'head')"));
  assert.ok(!/\(904, '(division|department|org)'/.test(seed));
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
