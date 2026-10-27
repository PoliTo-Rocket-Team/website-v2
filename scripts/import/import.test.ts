import "@/lib/dashboard/access-matrix/install";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  alumniEntries,
  alumniImportedRoles,
  applyPositions,
  betterAuthUsers,
  departments,
  divisions,
  faqVersions,
  members,
  orders,
  roles,
  scopes,
  teamLeaves,
  teamPageAdvisorVersions,
  users,
} from "@/db/schema";
import { alumniOf } from "@/lib/about/alumni-record";
import { readAlumniRecord } from "@/lib/dashboard/database-alumni";
import { myAlumniOf } from "@/lib/dashboard/my-alumni";
import { addRows, databaseWrites, restore, tableRows, testDb } from "@/lib/dashboard/access-matrix/test-database";
import type { ConflictKind } from "./conflicts";
import { TABLES } from "./plan";
import { runImport } from "./run";
import type { ImportDb } from "./snapshot";

// The team data import (issue #677) over the fake files in ./fixtures/files,
// on the in-memory Postgres every migration in drizzle/ built
// (lib/dashboard/access-matrix/test-database.ts). Migrations create no
// department or division, so the test lays the units a production database
// already holds, plus the rows a conflict needs: a seated chief engineer, an
// account with no member row, and an imported Alumni entry.

const FILES = join(__dirname, "fixtures", "files");
const db = testDb as unknown as ImportDb;
const PROPULSION = 1;
const STRUCTURES = 2;
const OPERATIONS = 3;
const HYBRID_MOTORS = 2;
const INFORMATION_TECHNOLOGY = 4;
const SEATED = 900;

async function world(): Promise<void> {
  await restore("team-import-world", async () => {
    await addRows(departments, [
      { id: PROPULSION, name: "Propulsion", code: "PRP" },
      { id: STRUCTURES, name: "Structures", code: "STR" },
      { id: OPERATIONS, name: "Operations", code: "OPS", kind: "operations" },
    ]);
    await addRows(divisions, [
      { id: 1, deptId: PROPULSION, name: "Liquid Systems", code: "LQS" },
      { id: HYBRID_MOTORS, deptId: PROPULSION, name: "Hybrid Motors", code: "HYB" },
      { id: 3, deptId: STRUCTURES, name: "Design and Manufacturing", code: "DAM" },
      { id: INFORMATION_TECHNOLOGY, deptId: OPERATIONS, name: "Information Technology", code: "IT" },
      { id: 5, deptId: OPERATIONS, name: "Communications", code: "COM" },
    ]);
    await addRows(members, [{ memberId: SEATED }]);
    await addRows(users, [
      { id: "seated-account", email: "seated.chief@example.com", firstName: "Seated", lastName: "Chief", member: SEATED },
      { id: "applicant-account", email: "wanda.riva@example.com", firstName: "Wanda", lastName: "Riva" },
    ]);
    await addRows(roles, [{ memberId: SEATED, title: "Chief Engineer", type: "core", fullAccess: "chief_engineer", startedAt: "2025-10-01" }]);
    await addRows(alumniEntries, [{ id: 9000, kind: "imported", recordName: "Paolo Lombardi" }]);
    await addRows(alumniImportedRoles, [{ entryId: 9000, year: 2023, groupName: "Propulsion", role: "Test Engineer", position: 1 }]);
  });
}

const importOnce = () => runImport({ mode: "import", directory: FILES, db });

async function userNamed(first: string, last: string) {
  const row = (await tableRows(users)).find((u) => u.firstName === first && u.lastName === last);
  return row as (typeof users.$inferSelect) | undefined;
}

async function rolesOf(memberId: number) {
  return ((await tableRows(roles)) as (typeof roles.$inferSelect)[]).filter((r) => r.memberId === memberId);
}

const kinds = (list: readonly { kind: ConflictKind }[]) => new Set(list.map((c) => c.kind));

test("a dry run reports every planted conflict and unclear quitter, and writes nothing", async () => {
  await world();
  const before = await Promise.all([users, members, roles, teamLeaves, departments, divisions, orders].map((t) => tableRows(t)));
  const { plan, report } = await runImport({ mode: "dry-run", directory: FILES, db });
  assert.deepEqual(await databaseWrites(), []);
  assert.deepEqual(await Promise.all([users, members, roles, teamLeaves, departments, divisions, orders].map((t) => tableRows(t))), before);

  for (const kind of [
    "duplicate",
    "ambiguous-match",
    "missing-email",
    "account-without-member",
    "unknown-unit",
    "unknown-title",
    "seat-taken",
    "csv-disagrees",
    "imported-alumni-match",
    "schema-misfit",
    "unresolved-requester",
    "quitter-on-current-sheet",
    "quitter-in-no-year",
  ] as const) {
    assert.ok(kinds(plan.conflicts).has(kind), `the plan reports ${kind}`);
    assert.match(report, new RegExp(`\\[${kind}\\] `), `the report lists ${kind}`);
  }
  // Three seat clashes this year: a second head of Propulsion, a second team leader, and the chief engineer the database already seats.
  assert.deepEqual(
    plan.conflicts.filter((c) => c.kind === "seat-taken").map((c) => `${c.at.sheet} ${c.at.row}`),
    ["2025-2026 6", "2025-2026 7", "2025-2026 16"],
  );
  assert.equal(plan.alumni, 3);
  assert.equal(plan.multiYear, 4);
  assert.equal(plan.unclearQuitters, 2);
  for (const table of TABLES) assert.match(report, new RegExp(`^${table} +\\d+ +\\d+ +\\d+$`, "m"), `the report counts ${table}`);
  assert.match(report, /^Alumni: 3$/m);
  assert.match(report, /^People found in more than one year sheet: 4$/m);
  assert.match(report, /^Unclear quitters: 2$/m);
  assert.match(report, /roster\.xlsx › sheet 2025-2026 › row 9 › field title/);
});

test("the report prints no personal value from the sources", async () => {
  await world();
  const { report } = await runImport({ mode: "dry-run", directory: FILES, db });
  const values = new Set<string>();
  for (const file of readdirSync(FILES).filter((f) => f.endsWith(".csv"))) {
    for (const cell of readFileSync(join(FILES, file), "utf8").split(/[,\n]/)) if (/@|^[A-Z][a-z]+$/.test(cell.trim())) values.add(cell.trim());
  }
  for (const name of ["Alice", "Marino", "Sara", "Testa", "Giulia", "Russo", "Ugo", "Sala", "Wanda", "Riva", "s900001", "+39 000 0000001", "alice.marino@example.com"]) values.add(name);
  for (const value of values) assert.ok(!report.includes(value), `the report leaves out a source value`);
});

test("an import inserts the planned rows once, and a second run inserts none and finds them present", async () => {
  await world();
  const first = await importOnce();
  assert.ok(first.written !== undefined);
  for (const table of TABLES) assert.equal(first.written[table], first.plan.counts[table].insert, `${table} inserted as planned`);
  assert.deepEqual(
    { users: first.written.users, roles: first.written.roles, team_leaves: first.written.team_leaves },
    { users: 16, roles: 15, team_leaves: 3 },
  );
  assert.ok((await databaseWrites()).every((w) => w.kind === "insert"), "every write is an insert");

  const second = await importOnce();
  for (const table of TABLES) {
    assert.equal(second.written?.[table], 0, `${table}: nothing inserted the second time`);
    assert.equal(second.plan.counts[table].present, first.plan.counts[table].present + first.plan.counts[table].insert, `${table}: all present`);
  }
  assert.match(second.report, /^users +0 +16 +2$/m);
});

test("the import creates no unit and changes no existing row", async () => {
  await world();
  const before = {
    departments: await tableRows(departments),
    divisions: await tableRows(divisions),
    seated: await rolesOf(SEATED),
    applicant: (await tableRows(users)).find((u) => u.id === "applicant-account"),
    imported: [await tableRows(alumniEntries), await tableRows(alumniImportedRoles)],
  };
  await importOnce();
  assert.deepEqual(await tableRows(departments), before.departments);
  assert.deepEqual(await tableRows(divisions), before.divisions);
  assert.deepEqual(await rolesOf(SEATED), before.seated);
  assert.deepEqual((await tableRows(users)).find((u) => u.id === "applicant-account"), before.applicant);
  assert.deepEqual([await tableRows(alumniEntries), await tableRows(alumniImportedRoles)], before.imported);
  assert.ok((await databaseWrites()).every((w) => w.kind === "insert" && !["departments", "divisions"].includes(w.table)));
});

test("a person in two years under different email columns is one user and member, with a role per year", async () => {
  await world();
  await importOnce();
  const alice = await userNamed("Alice", "Marino");
  assert.ok(alice?.member != null);
  assert.equal(alice.email, "alice.marino@example.com");
  assert.equal(alice.linkedin, "https://www.linkedin.com/in/alice-marino-example");
  assert.equal(await userNamed("Alice", "M. Marino"), undefined, "the 2024 spelling is the same person");
  const [member] = (await tableRows(members)).filter((m) => m.memberId === alice.member);
  assert.equal(member.prtEmail, "alice.marino@team.example.com");
  const held = (await rolesOf(alice.member)).map((r) => [r.title, r.type, r.startedAt, r.leavedAt]);
  assert.deepEqual(held, [
    ["Valve Engineer", "core", "2024-10-01", "2025-09-30"],
    ["Team Leader", "president", "2025-10-01", null],
  ]);
});

test("two past holders of one seat in one year are both inserted, as ended roles", async () => {
  await world();
  await importOnce();
  const heads = ((await tableRows(roles)) as (typeof roles.$inferSelect)[]).filter((r) => r.title === "Head of Structures");
  assert.equal(heads.length, 2);
  for (const h of heads) assert.deepEqual([h.type, h.deptId, h.startedAt, h.leavedAt], ["head", STRUCTURES, "2024-10-01", "2025-09-30"]);
});

test("an alumnus has their years, a team leave, ended roles only and no access, and the Alumni record lists them", async () => {
  await world();
  await importOnce();
  const sara = await userNamed("Sara", "Testa");
  assert.ok(sara?.member != null);
  const [member] = (await tableRows(members)).filter((m) => m.memberId === sara.member);
  assert.deepEqual([member.teamFrom, member.teamTo], [2023, 2024]);
  const leaves = (await tableRows(teamLeaves)).filter((l) => l.memberId === sara.member);
  assert.equal(leaves.length, 1);
  assert.match(String(leaves[0].leftAt), /^2025-07-15/);
  assert.equal(leaves[0].reason, null);
  const held = await rolesOf(sara.member);
  assert.deepEqual(
    held.map((r) => [r.title, r.type, r.divisionId, r.startedAt, r.leavedAt]),
    [
      ["Grain Engineer", "core", HYBRID_MOTORS, "2023-10-01", "2024-09-30"],
      ["Hybrid Motors Lead", "lead", HYBRID_MOTORS, "2024-10-01", "2025-09-30"],
    ],
  );
  assert.equal((await tableRows(scopes)).filter((s) => s.memberId === sara.member).length, 0);

  const alumnus = alumniOf(await readAlumniRecord(), 2025).find((a) => a.key === `m${sara.member}`);
  assert.ok(alumnus !== undefined, "the Alumni record lists her");
  assert.equal(alumnus.onTeam, false);
  assert.deepEqual([...new Set(alumnus.lines.map((l) => l.year))], [2023, 2024]);
  const mine = myAlumniOf(alumnus);
  assert.deepEqual(
    mine.history.map((h) => [h.year, h.role]),
    [
      ["2024 – 25", "Hybrid Motors Lead"],
      ["2023 – 24", "Grain Engineer"],
    ],
  );

  const tommaso = await userNamed("Tommaso", "Neri");
  const [left] = (await tableRows(teamLeaves)).filter((l) => l.memberId === tommaso?.member);
  assert.match(String(left.leftAt), /^2025-09-30/, "no Quitters day: the last year's end");
});

test("a quitter on the current sheet imports as an active member; one in no year sheet is not imported", async () => {
  await world();
  await importOnce();
  const giulia = await userNamed("Giulia", "Russo");
  assert.ok(giulia?.member != null);
  assert.deepEqual(
    (await rolesOf(giulia.member)).map((r) => [r.title, r.leavedAt]),
    [["Structural Analyst", null]],
  );
  assert.equal((await tableRows(teamLeaves)).filter((l) => l.memberId === giulia.member).length, 0);
  assert.equal(await userNamed("Ugo", "Sala"), undefined);
});

test("a person matching an imported Alumni entry gets no role for a year that entry lists", async () => {
  await world();
  await importOnce();
  const paolo = await userNamed("Paolo", "Lombardi");
  assert.ok(paolo?.member != null);
  assert.deepEqual(
    (await rolesOf(paolo.member)).map((r) => r.startedAt).sort(),
    ["2024-10-01", "2025-10-01"],
  );
});

test("a seat conflict this year refuses that role only; the run goes on", async () => {
  await world();
  const { written } = await importOnce();
  assert.ok(written !== undefined && written.roles > 0);
  const active = ((await tableRows(roles)) as (typeof roles.$inferSelect)[]).filter((r) => r.leavedAt === null);
  assert.equal(active.filter((r) => r.type === "president").length, 1);
  assert.equal(active.filter((r) => r.type === "head" && r.deptId === PROPULSION).length, 1);
  assert.deepEqual(active.filter((r) => r.fullAccess === "chief_engineer").map((r) => r.memberId), [SEATED]);
  assert.deepEqual(active.filter((r) => r.fullAccess === "it_lead").map((r) => [r.title, r.divisionId]), [["IT Lead", INFORMATION_TECHNOLOGY]]);
  for (const [first, last] of [["Elena", "Greco"], ["Zeno", "Fabbri"], ["Fabio", "Ricci"]]) {
    const person = await userNamed(first, last);
    assert.ok(person?.member != null, `${first} is imported`);
    assert.deepEqual(await rolesOf(person.member), [], `${first}'s clashing seat is not`);
  }
});

test("CSV rows fill gaps only, and advisors, positions, FAQs and orders land where they resolve", async () => {
  await world();
  await importOnce();
  const marta = await userNamed("Marta", "Villa");
  assert.equal(marta?.program, "Physics", "the workbook wins");
  assert.equal(marta?.linkedin, "https://www.linkedin.com/in/marta-villa-example", "the CSV fills a gap");
  const dario = await userNamed("Dario", "Gallo");
  assert.equal(dario?.program, "Computer Engineering");

  const advisorNames = (await tableRows(teamPageAdvisorVersions)).map((v) => (v.advisor as { name: string }).name);
  assert.ok(advisorNames.includes("Prof. Ada Example") && advisorNames.includes("Sam Specialist"));
  assert.equal(advisorNames.filter((n) => n === "Sam Specialist").length, 1);

  const positions = await tableRows(applyPositions);
  assert.deepEqual(
    positions.map((p) => [p.title, p.divisionId, p.status, p.requiredSkills, p.desirableSkills]),
    [
      ["Feed Systems Engineer", 1, true, ["Fluid dynamics", "Teamwork"], ["CAD", "Python"]],
      ["Web Developer", INFORMATION_TECHNOLOGY, true, ["TypeScript", "SQL"], []],
    ],
  );

  const faq = (await tableRows(faqVersions)).find((v) => v.question === "Can I join while on exchange?");
  assert.deepEqual(faq?.answer, ["Yes, if you can work remotely.", "Tell us in your application."]);
  assert.equal(faq?.version, "published");

  const placed = await tableRows(orders);
  assert.deepEqual(
    placed.map((o) => [o.requester, o.status, o.divisionId, o.quantity, o.name]),
    [[dario?.member, "accepted", INFORMATION_TECHNOLOGY, 2, "Router"]],
  );
});

test("an imported person's first Google sign-in lands on their imported user row and member", async () => {
  await world();
  await importOnce();
  const before = await userNamed("Sara", "Testa");
  assert.ok(before !== undefined && before.id.startsWith("imported:"));
  // Better Auth creates the account on the first Google sign-in; the sync_auth_users trigger (drizzle/0001) links it by email.
  await testDb.insert(betterAuthUsers).values({ id: "google-account-sara", name: "Sara Testa", email: before.email, emailVerified: true });
  const after = (await tableRows(users)).filter((u) => u.email === before.email);
  assert.equal(after.length, 1, "no second users row");
  assert.equal(after[0].id, "google-account-sara");
  assert.equal(after[0].member, before.member);
});
