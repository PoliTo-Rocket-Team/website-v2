import assert from "node:assert/strict";
import { test } from "node:test";
import { SCOPE_ROWS } from "../db/seed/access";
import { ROLE_ROWS, TESTER_AUTH_ROWS, TESTER_MEMBER, USER_ROWS } from "../db/seed/people";
import { DEPARTMENT } from "../db/seed/structure";
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

test("the seed gives the department head tester a head role in Payload, a test department, and no scope row", () => {
  const memberId = TESTER_MEMBER["department-head"];
  const held = ROLE_ROWS.rows.filter((r) => r.memberId === memberId);
  assert.deepEqual(
    held.map((r) => [r.type, r.deptId, r.divisionId ?? null, r.title, r.leavedAt ?? null]),
    [["head", DEPARTMENT.payload, null, "Head of Payload", null]],
  );
  assert.ok(!SCOPE_ROWS.rows.some((s) => s.memberId === memberId));
});

test("the seed puts every tester in better_auth.user and public.users", () => {
  for (const key of TESTER_KEYS) {
    const { id, email } = TESTERS[key];
    assert.ok(USER_ROWS.rows.some((u) => u.id === id && u.email === email), `public.users row for ${key}`);
    assert.ok(TESTER_AUTH_ROWS.rows.some((u) => u.id === id && u.email === email), `better_auth.user row for ${key}`);
  }
});
