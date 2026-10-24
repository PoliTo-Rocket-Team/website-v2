import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { SCOPE_ROWS } from "../db/seed/access";
import { ROLE_ROWS, TESTER_AUTH_ROWS, TESTER_MEMBER, USER_ROWS } from "../db/seed/people";
import { DEPARTMENT } from "../db/seed/structure";
import { TESTER_KEYS, TESTERS, isTesterKey, testerSignInOn } from "./dev-tester";
import { BASE, GATE_OFF, GATE_ON, LOOKALIKE_DB, OTHER_DB, PREVIEW_DB, PREVIEW_DB_DIRECT, TEST_ENV, envRestorer, memoryAuth, setEnv } from "./dev-tester-fixture";

afterEach(envRestorer());

test("tester sign-in is on for next dev with no VERCEL_ENV, whatever the database", () => {
  for (const DATABASE_URL of [undefined, PREVIEW_DB, OTHER_DB]) {
    assert.equal(testerSignInOn({ NODE_ENV: "development", DATABASE_URL }), true, String(DATABASE_URL));
    assert.equal(testerSignInOn({ NODE_ENV: "development", VERCEL_ENV: "", DATABASE_URL }), true, String(DATABASE_URL));
  }
});

test("tester sign-in is on for a preview whose database is the shared preview branch, whatever NODE_ENV says", () => {
  for (const NODE_ENV of ["production", "development", undefined]) {
    for (const DATABASE_URL of [PREVIEW_DB, PREVIEW_DB_DIRECT]) {
      assert.equal(testerSignInOn({ NODE_ENV, VERCEL_ENV: "preview", DATABASE_URL }), true, `${NODE_ENV} ${DATABASE_URL}`);
    }
  }
});

test("tester sign-in is off for production and test builds off Vercel", () => {
  for (const NODE_ENV of ["production", "test", undefined, "", "Development"]) {
    assert.equal(testerSignInOn({ NODE_ENV, DATABASE_URL: PREVIEW_DB }), false, String(NODE_ENV));
  }
});

test("tester sign-in is off on production and every other Vercel environment, even on the preview database", () => {
  for (const VERCEL_ENV of ["production", "development", "Preview", "staging"]) {
    for (const NODE_ENV of ["development", "production", "test"]) {
      assert.equal(testerSignInOn({ NODE_ENV, VERCEL_ENV, DATABASE_URL: PREVIEW_DB }), false, `${NODE_ENV}/${VERCEL_ENV}`);
    }
  }
});

test("tester sign-in is off on a preview pointed at another database or at none", () => {
  for (const DATABASE_URL of [OTHER_DB, undefined, "", "postgresql://app@localhost:5432/prt", LOOKALIKE_DB]) {
    assert.equal(testerSignInOn({ NODE_ENV: "production", VERCEL_ENV: "preview", DATABASE_URL }), false, String(DATABASE_URL));
  }
});

test("the gate is off under this test runner", () => {
  assert.equal(testerSignInOn(), false);
});

test("where the gate is off, getAuth keeps Google alone, registers no tester plugin, and the tester routes answer 404", async () => {
  for (const vars of GATE_OFF) {
    setEnv({ ...TEST_ENV, ...vars });
    const auth = await memoryAuth();
    const label = JSON.stringify(vars);

    assert.deepEqual(Object.keys(auth.options.socialProviders ?? {}), ["google"], label);
    assert.equal("emailAndPassword" in auth.options, false, label);
    assert.deepEqual(auth.options.plugins.map((plugin) => plugin.id), ["custom-session", "admin", "view-as"], label);

    for (const path of ["/dev-tester", "/dev-tester/sign-in?tester=member", "/dev-tester/sign-in?tester=admin-1"]) {
      const response = await auth.handler(new Request(BASE + path));
      assert.equal(response.status, 404, `${label} ${path}`);
      assert.equal(response.headers.getSetCookie().length, 0, `${label} ${path}`);
    }
  }
});

test("where the gate is on, getAuth registers the tester plugin beside Google alone", async () => {
  for (const vars of GATE_ON) {
    setEnv({ ...TEST_ENV, ...vars });
    const auth = await memoryAuth();
    const label = JSON.stringify(vars);
    assert.deepEqual(Object.keys(auth.options.socialProviders ?? {}), ["google"], label);
    assert.equal("emailAndPassword" in auth.options, false, label);
    assert.deepEqual(auth.options.plugins.map((plugin) => plugin.id), ["custom-session", "admin", "view-as", "dev-tester"], label);
  }
});

test("every tester key names a tester with its own id and email", () => {
  assert.deepEqual(Object.keys(TESTERS).sort(), [...TESTER_KEYS].sort());
  for (const key of TESTER_KEYS) assert.equal(TESTERS[key].key, key);
  assert.equal(new Set(TESTER_KEYS.map((key) => TESTERS[key].id)).size, TESTER_KEYS.length);
  assert.equal(new Set(TESTER_KEYS.map((key) => TESTERS[key].email)).size, TESTER_KEYS.length);
  assert.equal(isTesterKey("operations-lead"), true);
  assert.equal(isTesterKey("admin"), false);
});

test("the tester sign-in offers a department head (issue #230)", () => {
  assert.equal(isTesterKey("department-head"), true);
  assert.equal(TESTERS["department-head"].email, "department-head.tester@example.com");
});

test("the seed gives the department head tester a head role in Research and Development and no scope row", () => {
  const memberId = TESTER_MEMBER["department-head"];
  const held = ROLE_ROWS.rows.filter((r) => r.memberId === memberId);
  assert.deepEqual(
    held.map((r) => [r.type, r.deptId, r.divisionId ?? null, r.title, r.leavedAt ?? null]),
    [["head", DEPARTMENT.research, null, "Head of Research and Development", null]],
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
