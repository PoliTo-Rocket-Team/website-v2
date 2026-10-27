import "@/lib/dashboard/access-matrix/install";
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { departments, divisions, members, roles, teamLeaves, users } from "@/db/schema";
import { addRows, databaseWrites, restore, tableRows, testDb } from "@/lib/dashboard/access-matrix/test-database";
import { TABLES } from "./plan";
import { runImport } from "./run";
import type { ImportDb } from "./snapshot";

// The reading rules of issue #816 over the fake roster in ./fixtures/rules
// (planted by ./fixtures/make-fixtures.ts), on the in-memory Postgres every
// migration in drizzle/ built. The migrations seed the projects Cavour, VES
// and Efesto; the test lays the units the database already holds.

const FILES = join(__dirname, "fixtures", "rules");
const db = testDb as unknown as ImportDb;
const PROPULSION = 101;
const OPERATIONS = 102;
const ELECTRONICS = 103;
const HYBRID_MOTORS = 201;
const INFORMATION_TECHNOLOGY = 202;
const LOGISTICS = 203;
const HARDWARE = 204;
const FIRST_DAY = "2026-03-15";
const LATER_DAY = "2026-04-20";

async function world(): Promise<void> {
  await restore("team-import-rules-world", async () => {
    await addRows(departments, [
      { id: PROPULSION, name: "Propulsion", code: "PRP" },
      { id: OPERATIONS, name: "Operations", code: "OPS", kind: "operations" },
      { id: ELECTRONICS, name: "Electronics", code: "ELT" },
    ]);
    await addRows(divisions, [
      { id: HYBRID_MOTORS, deptId: PROPULSION, name: "Hybrid Motors", code: "HYB" },
      { id: INFORMATION_TECHNOLOGY, deptId: OPERATIONS, name: "Information Technology", code: "IT" },
      { id: LOGISTICS, deptId: OPERATIONS, name: "Logistics", code: "LGS" },
      { id: HARDWARE, deptId: ELECTRONICS, name: "Hardware", code: "HDW" },
    ]);
  });
}

const importOn = (today: string) => runImport({ mode: "import", directory: FILES, db, today });

type Role = typeof roles.$inferSelect;

async function rolesOf(first: string, last: string): Promise<Role[]> {
  const user = (await tableRows(users)).find((u) => u.firstName === first && u.lastName === last);
  assert.ok(user?.member != null, `${first} ${last} is imported`);
  return ((await tableRows(roles)) as Role[]).filter((r) => r.memberId === user.member).sort((a, b) => a.id - b.id);
}

async function unitId(table: typeof departments | typeof divisions, name: string): Promise<number> {
  const row = (await tableRows(table)).find((u) => u.name === name);
  assert.ok(row !== undefined, `${name} exists`);
  return row.id as number;
}

const shape = (r: Role) => [r.title, r.type, r.fullAccess, r.deptId, r.divisionId, r.startedAt, r.leavedAt];

test("a dry run counts the closed units it would create, reports only the planted conflicts, and writes nothing", async () => {
  await world();
  const { plan, report } = await runImport({ mode: "dry-run", directory: FILES, db, today: FIRST_DAY });
  assert.deepEqual(await databaseWrites(), []);
  assert.deepEqual(plan.departments.map((d) => d.name).sort(), ["Cavour", "Efesto", "Liquid Propulsion", "Management", "Vittorio Emanuele II"]);
  assert.deepEqual(plan.divisions.map((d) => d.name).sort(), ["Injectors", "Solid Motors"]);
  assert.match(report, /^departments +5 +\d+ +0$/m);
  assert.match(report, /^divisions +2 +\d+ +0$/m);
  assert.match(report, /^Past units to create closed: 5 departments, 2 divisions$/m);
  assert.match(report, /^Seat handovers applied \(handovers\.csv\): 1$/m);
  // From 2024-2025 on, a subteam that names a project is a project again; a handover on a past sheet is not applied.
  assert.deepEqual(
    plan.conflicts.map((c) => [c.kind, c.at.file, c.at.sheet ?? null, c.at.row]),
    [
      ["handover-unmatched", "handovers.csv", null, 3],
      ["project-only-unit", "roster.xlsx", "2024-2025", 3],
    ],
  );
  assert.equal(plan.unresolvedUnits, 0);
});

test("past subteams are departments, created closed over the years the roster names them; existing units are matched", async () => {
  await world();
  await importOn(FIRST_DAY);
  const created = (await tableRows(departments)).filter((d) => ![PROPULSION, OPERATIONS, ELECTRONICS].includes(d.id as number));
  assert.deepEqual(
    created.map((d) => [d.name, d.code, d.startedAt, d.closedAt, d.kind]).sort(),
    [
      ["Cavour", null, "2022-10-01", "2023-09-30", "technical"],
      ["Efesto", null, "2021-10-01", "2025-09-30", "technical"],
      ["Liquid Propulsion", null, "2021-10-01", "2023-09-30", "technical"],
      ["Management", null, "2022-10-01", "2023-09-30", "technical"],
      ["Vittorio Emanuele II", "VES", "2022-10-01", "2023-09-30", "technical"],
    ],
  );
  const liquid = await unitId(departments, "Liquid Propulsion");
  const newDivisions = (await tableRows(divisions)).filter((d) => (d.id as number) > HARDWARE || (d.id as number) < HYBRID_MOTORS);
  assert.deepEqual(
    newDivisions.map((d) => [d.name, d.code, d.deptId, d.startedAt, d.closedAt]).sort(),
    [
      ["Injectors", "INJ", liquid, "2022-10-01", "2023-09-30"],
      ["Solid Motors", "SLM", PROPULSION, "2022-10-01", "2025-09-30"],
    ],
  );

  const efesto = await unitId(departments, "Efesto");
  assert.deepEqual((await rolesOf("Pia", "Orsi")).map(shape), [["Engineer", "core", null, efesto, null, "2021-10-01", "2022-09-30"]]);
  // Quinto's subteam comes from the Roles 24-25 sheet, which reads a project's name as a past subteam.
  assert.deepEqual((await rolesOf("Quinto", "Rossi")).map(shape), [["Engineer", "core", null, efesto, null, "2024-10-01", "2025-09-30"]]);
  const injectors = await unitId(divisions, "Injectors");
  assert.deepEqual(
    (await rolesOf("Mario", "Lodi")).map(shape).sort((a, b) => String(a[5]).localeCompare(String(b[5]))),
    [
      ["Engineer", "core", null, liquid, null, "2021-10-01", "2022-09-30"],
      ["Engineer", "core", null, liquid, injectors, "2022-10-01", "2023-09-30"],
    ],
  );
  const ves = await unitId(departments, "Vittorio Emanuele II");
  const management = await unitId(departments, "Management");
  assert.deepEqual((await rolesOf("Nora", "Monti")).map((r) => r.deptId).sort(), [ves, management].sort());
  const solid = await unitId(divisions, "Solid Motors");
  assert.deepEqual((await rolesOf("Ivo", "Jori")).map((r) => [r.deptId, r.divisionId, r.startedAt]).sort(), [
    [PROPULSION, solid, "2022-10-01"],
    [PROPULSION, solid, "2024-10-01"],
  ]);
});

test("AMV is ignored, '/' and ',' split units, and a row gets a role per division and per department no division covers", async () => {
  await world();
  await importOn(FIRST_DAY);
  assert.deepEqual((await rolesOf("Anna", "Bello")).map(shape), [["Chief Engineer", "core", "chief_engineer", null, null, "2025-10-01", null]]);
  assert.deepEqual(
    (await rolesOf("Emma", "Fermi")).map((r) => [r.deptId, r.divisionId]).sort(),
    [
      [PROPULSION, HYBRID_MOTORS],
      [OPERATIONS, INFORMATION_TECHNOLOGY],
      [OPERATIONS, LOGISTICS],
    ],
  );
  assert.deepEqual(
    (await rolesOf("Franco", "Gatti")).map((r) => [r.deptId, r.divisionId, r.leavedAt]).sort(),
    [
      [PROPULSION, HYBRID_MOTORS, null],
      [ELECTRONICS, null, null],
    ],
  );
});

test("the #816 titles: Safety Officer, '<Dept> Head of Department - <Division> Lead Engineer', 'President & Chief Engineer', 'President-Advisor (Project Cavour)'", async () => {
  await world();
  await importOn(FIRST_DAY);
  assert.deepEqual((await rolesOf("Bianca", "Corsi")).map(shape), [["Safety Officer", "core", null, OPERATIONS, LOGISTICS, "2025-10-01", null]]);
  assert.deepEqual((await rolesOf("Gina", "Hale")).map(shape), [
    ["Electronics Head of Department", "head", null, ELECTRONICS, null, "2024-10-01", "2025-09-30"],
    ["Hardware Lead Engineer", "lead", null, ELECTRONICS, HARDWARE, "2024-10-01", "2025-09-30"],
  ]);
  assert.deepEqual((await rolesOf("Oscar", "Neri")).map(shape), [
    ["President", "president", null, null, null, "2021-10-01", "2022-09-30"],
    ["Chief Engineer", "core", "chief_engineer", null, null, "2021-10-01", "2022-09-30"],
  ]);
  const cavour = await unitId(departments, "Cavour");
  assert.deepEqual((await rolesOf("Lia", "Kent")).map(shape), [
    ["President", "president", null, null, null, "2022-10-01", "2023-09-30"],
    ["Advisor (Project Cavour)", "advisor", null, cavour, null, "2022-10-01", "2023-09-30"],
  ]);
});

test("a seat handed over this year: the later holder holds it, the earlier one keeps the membership and an ended role, and no seat-taken", async () => {
  await world();
  const { plan } = await importOn(FIRST_DAY);
  assert.ok(!plan.conflicts.some((c) => c.kind === "seat-taken"));
  assert.deepEqual((await rolesOf("Davide", "Elia")).map(shape), [["Project Manager", "core", "project_manager", null, null, "2025-10-01", null]]);
  assert.deepEqual((await rolesOf("Carlo", "Dini")).map(shape), [["Project Manager", "core", "project_manager", null, null, "2025-10-01", FIRST_DAY]]);
  const carlo = (await tableRows(users)).find((u) => u.firstName === "Carlo")!;
  const [member] = (await tableRows(members)).filter((m) => m.memberId === carlo.member);
  assert.deepEqual([member.teamFrom, member.teamTo], [null, null], "an active member");
  assert.equal((await tableRows(teamLeaves)).filter((l) => l.memberId === carlo.member).length, 0, "no team leave");
});

test("a second run, on a later day, creates no second closed unit and no second role", async () => {
  await world();
  const first = await importOn(FIRST_DAY);
  assert.ok(first.written !== undefined);
  for (const table of TABLES) assert.equal(first.written[table], first.plan.counts[table].insert, `${table} inserted as planned`);
  const units = [await tableRows(departments), await tableRows(divisions)];
  const roleCount = (await tableRows(roles)).length;

  const second = await importOn(LATER_DAY);
  for (const table of TABLES) {
    assert.equal(second.written?.[table], 0, `${table}: nothing inserted the second time`);
    assert.equal(second.plan.counts[table].present, first.plan.counts[table].present + first.plan.counts[table].insert, `${table}: all present`);
  }
  assert.deepEqual([await tableRows(departments), await tableRows(divisions)], units);
  assert.equal((await tableRows(roles)).length, roleCount);
  assert.deepEqual((await rolesOf("Carlo", "Dini")).map((r) => r.leavedAt), [FIRST_DAY], "the handed-over role keeps its first end day");
  assert.ok(!second.plan.conflicts.some((c) => c.kind === "seat-taken"));
});
