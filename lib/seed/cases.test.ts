import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { ANONYMIZED_EMAIL, CLEARED_MEMBER } from "../dashboard/anonymize";
import { TEST_VIEWERS } from "../dashboard/viewer";
import { TESTERS } from "../dev-tester";
import { ANONYMIZED_KEPT_NAME } from "../../db/seed/alumni";
import { caseDocRow, isActive, resolvesTo, SEED_CASES, SEED_DATA, alumniOfSeed } from "../../db/seed/cases";
import { ANONYMIZED_ALUMNUS, TESTER_AUTH_ROWS, TEST_VIEWER_PEOPLE } from "../../db/seed/people";
import { BASELINE_SQL_PATH } from "../../db/seed/baseline";

const data = SEED_DATA;

for (const seedCase of SEED_CASES) {
  test(`seed case holds: ${seedCase.area}: ${seedCase.case}`, () => {
    assert.ok(seedCase.holds(data));
  });
}

test("docs/seed-cases.md lists every case, with the issue it exercises, and no other", () => {
  const doc = readFileSync(resolve(process.cwd(), "docs/seed-cases.md"), "utf8");
  const cases = doc.slice(doc.indexOf("## Cases"), doc.indexOf("\n## ", doc.indexOf("## Cases") + 1));
  const rows = cases.split("\n").filter((line) => /^\| (structure|people|alumni|access) \|/.test(line));
  assert.deepEqual(rows, SEED_CASES.map(caseDocRow));
});

// Invariants (issue #304).

test("no closed division has people: no active role and no grant in it", () => {
  const closed = data.divisions.filter((d) => d.closedAt != null);
  assert.ok(closed.length > 0);
  for (const division of closed) {
    assert.deepEqual(data.roles.filter((r) => r.divisionId === division.id && isActive(r)), [], `${division.name} has people`);
    assert.deepEqual(data.scopes.filter((s) => s.divisionId === division.id), [], `${division.name} has grants`);
  }
});

test("every role sits inside its unit's life: started after it opened, ended by the time it closed", () => {
  for (const role of data.roles) {
    for (const unit of [data.divisions.find((d) => d.id === role.divisionId), data.departments.find((d) => d.id === role.deptId)]) {
      if (unit === undefined) continue;
      assert.ok(role.startedAt! >= unit.startedAt!, `${role.title} (member ${role.memberId}) starts before ${unit.name}`);
      if (unit.closedAt != null) {
        assert.ok(role.leavedAt != null && role.leavedAt <= unit.closedAt, `${role.title} outlives ${unit.name}`);
      }
    }
    if (role.leavedAt != null) assert.ok(role.leavedAt >= role.startedAt!, `${role.title} ends before it starts`);
  }
});

test("the anonymized alumnus carries no personal data but keeps its alumni entry", () => {
  const user = data.users.find((u) => u.member === ANONYMIZED_ALUMNUS);
  const member = data.members.find((m) => m.memberId === ANONYMIZED_ALUMNUS);
  assert.ok(user && member);
  assert.equal(user.email, ANONYMIZED_EMAIL);
  for (const key of ["firstName", "lastName", "phone", "linkedin", "politoId"] as const) assert.equal(user[key] ?? null, null, key);
  assert.ok(user.deletedAt != null && user.anonymizedAt != null && user.deletedAt < user.anonymizedAt);
  for (const [key, value] of Object.entries(CLEARED_MEMBER)) assert.equal(member[key as keyof typeof member] ?? null, value, key);
  assert.ok(!TESTER_AUTH_ROWS.rows.some((row) => row.id === user.id), "an anonymized account has no sign-in");

  const entry = data.alumniEntries.find((e) => e.memberId === ANONYMIZED_ALUMNUS);
  assert.ok(entry);
  assert.equal(entry.recordName, ANONYMIZED_KEPT_NAME);
  assert.equal(entry.photo ?? null, null);
  const alumnus = alumniOfSeed(data).find((a) => a.key === `m${ANONYMIZED_ALUMNUS}`);
  assert.ok(alumnus, "the Alumni page still lists them");
  assert.equal(alumnus.name, ANONYMIZED_KEPT_NAME);
  assert.equal(alumnus.email, ANONYMIZED_EMAIL);
});

test("every test viewer resolves to a seeded person read as that viewer", () => {
  for (const viewer of TEST_VIEWERS) {
    assert.ok(data.users.some((u) => u.id === TEST_VIEWER_PEOPLE[viewer]), `${viewer} has no seeded person`);
    assert.ok(resolvesTo(data, viewer), `${viewer} reads as someone else`);
  }
});

test("each local tester is seeded with the id and email lib/dev-tester.ts names, and can sign in", () => {
  for (const tester of Object.values(TESTERS)) {
    assert.ok(data.users.some((u) => u.id === tester.id && u.email === tester.email), tester.key);
    assert.ok(TESTER_AUTH_ROWS.rows.some((row) => row.id === tester.id && row.email === tester.email), tester.key);
  }
});

// The schema: every reference resolves, and every key is unique.

function unique<T>(values: readonly T[], what: string) {
  assert.equal(new Set(values).size, values.length, `${what} repeats`);
}

test("every key the seed sets is unique", () => {
  unique(data.departments.map((d) => d.id), "a department id");
  unique(data.divisions.map((d) => d.id), "a division id");
  unique(data.divisions.map((d) => d.code), "a division code");
  unique(data.members.map((m) => m.memberId), "a member id");
  unique(data.users.map((u) => u.id), "a user id");
  unique(data.users.flatMap((u) => (u.member == null ? [] : [u.member])), "a user's member");
  unique(data.users.map((u) => u.email), "an email");
  unique(data.alumniEntries.map((e) => e.memberId), "an alumni entry's member");
  unique(
    data.scopes.map((s) => [s.memberId, s.scope, s.target, s.deptId ?? null, s.divisionId ?? null].join("/")),
    "a grant",
  );
});

test("every reference the seed makes resolves to a seeded row", () => {
  const memberIds = new Set(data.members.map((m) => m.memberId));
  const departmentIds = new Set(data.departments.map((d) => d.id));
  const divisions = new Map(data.divisions.map((d) => [d.id, d]));
  for (const d of data.divisions) assert.ok(departmentIds.has(d.deptId ?? undefined), `division ${d.name}`);
  for (const u of data.users) if (u.member != null) assert.ok(memberIds.has(u.member), `user ${u.id}`);
  for (const m of data.members) assert.ok(data.users.some((u) => u.member === m.memberId), `member ${m.memberId} has no user`);
  for (const r of data.roles) {
    assert.ok(memberIds.has(r.memberId ?? undefined), `role ${r.title}`);
    if (r.deptId != null) assert.ok(departmentIds.has(r.deptId), `role ${r.title}`);
    if (r.divisionId != null) {
      const division = divisions.get(r.divisionId);
      assert.ok(division, `role ${r.title}`);
      assert.equal(r.deptId, division.deptId, `role ${r.title} names another department than its division's`);
    }
  }
  for (const s of data.scopes) {
    assert.ok(memberIds.has(s.memberId ?? undefined), `grant of ${s.memberId}`);
    if (s.givenBy != null) assert.ok(memberIds.has(s.givenBy), `grant given by ${s.givenBy}`);
    if (s.deptId != null) assert.ok(departmentIds.has(s.deptId));
    if (s.divisionId != null) assert.ok(divisions.has(s.divisionId));
  }
  for (const e of data.alumniEntries) {
    assert.ok(memberIds.has(e.memberId ?? undefined), `alumni entry ${e.id}`);
    assert.ok(!data.roles.some((r) => r.memberId === e.memberId && isActive(r)), `alumni entry ${e.id} is someone on the team`);
  }
});

test("the orders and applications db/seed.sql still holds name seeded people", () => {
  const sql = readFileSync(BASELINE_SQL_PATH, "utf8").replace(/--.*$/gm, "");
  const orders = sql.slice(sql.indexOf("INSERT INTO orders"), sql.indexOf("INSERT INTO apply_positions"));
  const requesters = [...orders.matchAll(/^\('[a-z_]+', (\d+),/gm)].map((m) => Number(m[1]));
  assert.ok(requesters.length > 0);
  for (const id of requesters) assert.ok(data.members.some((m) => m.memberId === id), `order requester ${id}`);

  const positions = sql.slice(sql.indexOf("INSERT INTO apply_positions"), sql.indexOf("INSERT INTO applications"));
  const positionDivisions = [...positions.matchAll(/^\('(?:true|false)', (\d+),/gm)].map((m) => Number(m[1]));
  assert.ok(positionDivisions.length > 0);
  for (const id of positionDivisions) {
    const division = data.divisions.find((d) => d.id === id);
    assert.ok(division && division.closedAt == null, `position in division ${id}`);
  }

  const applications = sql.slice(sql.indexOf("INSERT INTO applications"));
  const applicants = [...applications.matchAll(/^\(\d+, '([0-9a-f-]{36})'/gm)].map((m) => m[1]);
  assert.ok(applicants.length > 0);
  for (const id of applicants) assert.ok(data.users.some((u) => u.id === id && u.member == null), `applicant ${id}`);
});
