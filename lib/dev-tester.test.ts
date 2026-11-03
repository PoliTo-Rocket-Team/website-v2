import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { SCOPE_ROWS } from "../db/seed/access";
import { PROPULSION_HEAD, ROLE_ROWS, SIGN_IN_ROWS, USER_ROWS } from "../db/seed/people";
import { DEPARTMENT } from "../db/seed/structure";
import { testerSignInOn } from "./dev-tester";
import { ADMIN_TESTERS, isSeededEmail, seatOf } from "./seeded-accounts";
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
    assert.deepEqual(auth.options.plugins.map((plugin) => plugin.id), ["custom-session", "admin", "view-as", "google-accounts", "login-merge"], label);

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
    assert.deepEqual(auth.options.plugins.map((plugin) => plugin.id), ["custom-session", "admin", "view-as", "google-accounts", "login-merge", "dev-tester"], label);
  }
});

test("no seeded person is a dedicated tester: no user is named Tester but the admin testers, and no member is (issue #653)", () => {
  const testers = USER_ROWS.rows.filter((u) => u.firstName === "Tester" || u.email.endsWith(".tester@example.com"));
  assert.deepEqual(testers.map((u) => u.id).sort(), ADMIN_TESTERS.map((a) => a.id).sort());
  for (const user of testers) assert.equal(user.member ?? null, null, `${user.email} has no member row`);
  assert.ok(!ROLE_ROWS.rows.some((r) => r.memberId != null && r.memberId >= 900 && r.memberId < 1000), "the old tester members 901 to 910 are gone");
});

test("the department-head seat is the seeded head of Propulsion, with no scope row (issue #644)", () => {
  const seat = seatOf("department-head");
  assert.equal(seat.memberId, PROPULSION_HEAD);
  const held = ROLE_ROWS.rows.filter((r) => r.memberId === seat.memberId && r.leavedAt == null);
  assert.deepEqual(
    held.map((r) => [r.type, r.deptId, r.divisionId ?? null, r.title]),
    [["head", DEPARTMENT.propulsion, null, "Head of Propulsion"]],
  );
  assert.ok(!SCOPE_ROWS.rows.some((s) => s.memberId === seat.memberId));
});

test("the seed gives every seeded person a sign-in row, under the id and email of their users row, so the tester sign-in reaches anyone (issue #653)", () => {
  for (const user of USER_ROWS.rows) {
    const signIn = SIGN_IN_ROWS.rows.filter((row) => row.id === user.id);
    if (user.anonymizedAt != null) {
      assert.deepEqual(signIn, [], `${user.id}: an anonymized account has no sign-in`);
      continue;
    }
    assert.deepEqual(signIn.map((row) => row.email), [user.email], `${user.email} has one sign-in row`);
    assert.ok(isSeededEmail(user.email), `${user.email} is on the seed's reserved domain`);
  }
  assert.equal(SIGN_IN_ROWS.rows.length, USER_ROWS.rows.filter((u) => u.anonymizedAt == null).length, "a sign-in row is a seeded person's");
});
