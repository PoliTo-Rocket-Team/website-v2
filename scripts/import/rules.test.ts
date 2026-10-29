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
// and its overrides.csv (planted by ./fixtures/make-fixtures.ts), on the in-memory Postgres every
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

test("a dry run lists each unit it would create by name, open or closed, reports only the planted conflicts, and writes nothing", async () => {
  await world();
  const { plan, report } = await runImport({ mode: "dry-run", directory: FILES, db, today: FIRST_DAY });
  assert.deepEqual(await databaseWrites(), []);
  assert.deepEqual(plan.departments.map((d) => d.name).sort(), ["Avionics", "Cavour", "Efesto", "Liquid Propulsion", "Management", "Vittorio Emanuele II"]);
  assert.deepEqual(plan.divisions.map((d) => d.name).sort(), ["Flight Software", "Injectors", "Solid Motors"]);
  assert.match(report, /^departments +6 +\d+ +0$/m);
  assert.match(report, /^divisions +3 +\d+ +0$/m);
  assert.match(report, /^Units to create: 6 departments, 3 divisions$/m);
  for (const line of [
    "department Avionics (AVI): open, from 2025-10-01",
    "department Cavour: closed, 2022-10-01 to 2023-09-30",
    "department Efesto: closed, 2021-10-01 to 2025-09-30",
    "department Liquid Propulsion: closed, 2021-10-01 to 2023-09-30",
    "department Management: closed, 2022-10-01 to 2023-09-30",
    "department Vittorio Emanuele II (VES): closed, 2022-10-01 to 2023-09-30",
    "division Flight Software (FSW) under Avionics: open, from 2025-10-01",
    "division Injectors (INJ) under Liquid Propulsion: closed, 2022-10-01 to 2023-09-30",
    "division Solid Motors (SLM) under an existing department: closed, 2022-10-01 to 2025-09-30",
  ]) {
    assert.ok(report.includes(`\n  ${line}\n`), `the report lists ${line}`);
  }
  assert.match(report, /^Seat handovers applied \(overrides\.csv\): 2$/m);
  assert.match(report, /^Quitter years applied \(overrides\.csv\): 1$/m);
  assert.match(report, /^Sheet rows with no name, skipped: 2$/m);
  assert.match(report, /^Unclear quitters: 2$/m);
  // From 2024-2025 on, a subteam that names a project is a project again. An override line on a past sheet,
  // on a quitter who is on a year sheet, or of an unknown kind is not applied. The two position-division lines
  // (8 and 9) are the positions-only run's, so neither raises anything here, the one that does not read included. A 2022-2023 joining day does
  // not read. Two quitters have no usable date. The Roles 22-23 sheet is not read, so its unmatched row raises nothing.
  assert.deepEqual(
    plan.conflicts.map((c) => [c.kind, c.at.file, c.at.sheet ?? null, c.at.row, c.field ?? null]),
    [
      ["override-unmatched", "overrides.csv", null, 3, "sheet"],
      ["override-unmatched", "overrides.csv", null, 5, "row"],
      ["override-unmatched", "overrides.csv", null, 6, "kind"],
      ["joined-date-unreadable", "roster.xlsx", "2022-2023", 5, "joinedOn"],
      ["project-only-unit", "roster.xlsx", "2024-2025", 3, "subteam"],
      ["quitter-no-date", "roster.xlsx", "Quitters", 7, "leftOn"],
      ["quitter-date-unreadable", "roster.xlsx", "Quitters", 8, "leftOn"],
    ],
  );
  assert.match(report, /\[quitter-no-date\] roster\.xlsx › sheet Quitters › row 7: /);
  assert.match(report, /\[quitter-date-unreadable\] roster\.xlsx › sheet Quitters › row 8: /);
  assert.equal(plan.unresolvedUnits, 0);
});

test("past subteams are departments, created closed over the years the roster names them; existing units are matched", async () => {
  await world();
  await importOn(FIRST_DAY);
  const created = (await tableRows(departments)).filter((d) => ![PROPULSION, OPERATIONS, ELECTRONICS].includes(d.id as number) && d.closedAt !== null);
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
  const newDivisions = (await tableRows(divisions)).filter((d) => ((d.id as number) > HARDWARE || (d.id as number) < HYBRID_MOTORS) && d.closedAt !== null);
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
  // Mario's 2022-2023 division is in that sheet's "A" column, and his role starts on its "Date of joining".
  assert.deepEqual(
    (await rolesOf("Mario", "Lodi")).map(shape).sort((a, b) => String(a[5]).localeCompare(String(b[5]))),
    [
      ["Engineer", "core", null, liquid, null, "2021-10-01", "2022-09-30"],
      ["Engineer", "core", null, liquid, injectors, "2022-11-15", "2023-09-30"],
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

test("the 2022-2023 sheet: Roles 22-23 is not read, the 'A' column is Division, and 'Date of joining' starts the year's roles", async () => {
  await world();
  const { plan, sources } = await importOn(FIRST_DAY);
  assert.ok(sources.skipped.some((s) => s.endsWith("› Roles 22-23: not read (owner decision); that year's own sheet is its only source")));
  assert.ok(!sources.read.some((s) => s.endsWith("› Roles 22-23")));
  assert.ok(!plan.conflicts.some((c) => c.kind === "roles-sheet-unmatched"), "no roles-sheet-unmatched");
  assert.ok(!(await tableRows(divisions)).some((d) => d.name === "Hydraulics"), "nothing comes from Roles 22-23");
  const cavour = await unitId(departments, "Cavour");
  // No joining day: the year's first day. Lia's empty Division cell stays empty.
  assert.deepEqual((await rolesOf("Lia", "Kent")).map((r) => [r.deptId, r.divisionId, r.startedAt]), [
    [null, null, "2022-10-01"],
    [cavour, null, "2022-10-01"],
  ]);
  // A "d/m/yyyy" joining day; a joining day that does not read is reported and the year's first day used.
  assert.deepEqual((await rolesOf("Nora", "Monti")).map((r) => r.startedAt), ["2022-12-01", "2022-12-01"]);
  assert.deepEqual((await rolesOf("Ivo", "Jori")).map((r) => r.startedAt).sort(), ["2022-10-01", "2024-10-01"]);
});

/** A member's active roles: the ones the app reads to place them on the team. */
const activeOf = async (first: string, last: string) => (await rolesOf(first, last)).filter((r) => r.leavedAt === null);

test("a seat handed over this year: the later holder holds it, the earlier one keeps an active membership and an ended role, and no seat-taken", async () => {
  await world();
  const { plan } = await importOn(FIRST_DAY);
  assert.ok(!plan.conflicts.some((c) => c.kind === "seat-taken"));
  assert.ok(!plan.conflicts.some((c) => c.kind === "override-unmatched" && c.at.row === 7), "the head seat of a department this run creates is handed over");
  assert.deepEqual((await rolesOf("Davide", "Elia")).map(shape), [["Project Manager", "core", "project_manager", null, null, "2025-10-01", null]]);
  // The Project Manager seat was Carlo's only role: he keeps a plain member's role, so he is still on the team.
  assert.deepEqual((await rolesOf("Carlo", "Dini")).map(shape), [
    ["Project Manager", "core", "project_manager", null, null, "2025-10-01", FIRST_DAY],
    ["Member", "core", null, null, null, "2025-10-01", null],
  ]);
  assert.equal((await activeOf("Carlo", "Dini")).length, 1, "one active role");
  const carlo = (await tableRows(users)).find((u) => u.firstName === "Carlo")!;
  const [member] = (await tableRows(members)).filter((m) => m.memberId === carlo.member);
  assert.deepEqual([member.teamFrom, member.teamTo], [null, null], "an active member");
  assert.equal((await tableRows(teamLeaves)).filter((l) => l.memberId === carlo.member).length, 0, "no team leave");
  // A head seat: Yara keeps a member's role in the department she headed.
  const avionics = await unitId(departments, "Avionics");
  assert.deepEqual((await rolesOf("Leo", "Pini")).map(shape), [["Head of Department", "head", null, avionics, null, "2025-10-01", null]]);
  assert.deepEqual((await rolesOf("Yara", "Gori")).map(shape), [
    ["Head of Department", "head", null, avionics, null, "2025-10-01", FIRST_DAY],
    ["Member", "core", null, avionics, null, "2025-10-01", null],
  ]);
  assert.equal((await activeOf("Yara", "Gori")).length, 1, "one active role");
});

test("units the current sheet names and the database lacks are created open, a division under its paired department", async () => {
  await world();
  await importOn(FIRST_DAY);
  const avionics = (await tableRows(departments)).find((d) => d.name === "Avionics");
  assert.deepEqual([avionics?.code, avionics?.startedAt, avionics?.closedAt], ["AVI", "2025-10-01", null]);
  const software = (await tableRows(divisions)).find((d) => d.name === "Flight Software");
  assert.deepEqual([software?.code, software?.deptId, software?.startedAt, software?.closedAt], ["FSW", avionics?.id, "2025-10-01", null]);
  assert.deepEqual((await rolesOf("Rosa", "Sarti")).map(shape), [["Engineer", "core", null, avionics?.id, software?.id, "2025-10-01", null]]);
});

/** A member's alumni years and their one team leave day. */
async function alumnusOf(first: string, last: string): Promise<[number | null, number | null, string[]]> {
  const user = (await tableRows(users)).find((u) => u.firstName === first && u.lastName === last);
  const [member] = ((await tableRows(members)) as (typeof members.$inferSelect)[]).filter((m) => m.memberId === user?.member);
  const leaves = (await tableRows(teamLeaves)).filter((l) => l.memberId === user?.member).map((l) => String(l.leftAt).slice(0, 10));
  return [member.teamFrom, member.teamTo, leaves];
}

test("a quitter on no year sheet is an alumnus of the year they left in, from their join day (else the year's start) to their leave day", async () => {
  await world();
  await importOn(FIRST_DAY);
  const efesto = await unitId(departments, "Efesto");
  const liquid = await unitId(departments, "Liquid Propulsion");
  // A date cell to leave, a "dd/mm/yyyy" join day.
  assert.deepEqual((await rolesOf("Sergio", "Tosi")).map(shape), [["Engineer", "core", null, efesto, null, "2021-11-10", "2023-02-15"]]);
  assert.deepEqual(await alumnusOf("Sergio", "Tosi"), [2021, 2022, ["2023-02-15"]]);
  // "d/m/yyyy", no join day: the start of the academic year; units read as on a past sheet.
  assert.deepEqual((await rolesOf("Teresa", "Ugolini")).map(shape), [["Engineer", "core", null, PROPULSION, HYBRID_MOTORS, "2023-10-01", "2024-03-05"]]);
  assert.deepEqual(await alumnusOf("Teresa", "Ugolini"), [2023, 2023, ["2024-03-05"]]);
  // "dd.mm.yyyy", a date cell to join.
  assert.deepEqual((await rolesOf("Ugo", "Valli")).map(shape), [["Engineer", "core", null, liquid, null, "2020-10-15", "2022-06-30"]]);
  assert.deepEqual(await alumnusOf("Ugo", "Valli"), [2020, 2021, ["2022-06-30"]]);
});

test("an override line places a dateless quitter in its year; a quitter with no date and no override, or a date that does not read, is not imported", async () => {
  await world();
  await importOn(FIRST_DAY);
  const management = await unitId(departments, "Management");
  assert.deepEqual((await rolesOf("Vera", "Zanni")).map(shape), [["Engineer", "core", null, management, null, "2022-10-01", "2023-09-30"]]);
  assert.deepEqual(await alumnusOf("Vera", "Zanni"), [2022, 2022, ["2023-09-30"]]);
  const imported = (await tableRows(users)).map((u) => u.firstName);
  assert.ok(!imported.includes("Walter") && !imported.includes("Xenia"), "the unclear quitters are not imported");
  // The line naming Pia's Quitters row is not applied: she keeps her year-sheet role and her Quitters day.
  assert.deepEqual((await rolesOf("Pia", "Orsi")).map((r) => [r.startedAt, r.leavedAt]), [["2021-10-01", "2022-09-30"]]);
  assert.deepEqual((await alumnusOf("Pia", "Orsi"))[2], ["2022-06-30"]);
});

test("a sheet row with no name is skipped without a conflict and never matched by its email", async () => {
  await world();
  const { plan, sources } = await importOn(FIRST_DAY);
  assert.equal(sources.namelessRows, 2);
  assert.ok(!plan.conflicts.some((c) => c.kind === "duplicate" || c.kind === "ambiguous-match"), "no conflict for the template rows");
  assert.equal((await rolesOf("Anna", "Bello")).length, 1, "Anna gets nothing from the template row that carries her email");
  assert.equal((await rolesOf("Pia", "Orsi")).length, 1, "Pia gets nothing from the nameless Quitters row");
  assert.ok(!(await tableRows(users)).some((u) => u.email === "name.surname@studenti.example.com" || u.firstName === null), "no person starts from a nameless row");
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
  assert.deepEqual((await rolesOf("Carlo", "Dini")).map((r) => r.leavedAt), [FIRST_DAY, null], "the handed-over role keeps its first end day, and no second membership role");
  assert.ok(!second.plan.conflicts.some((c) => c.kind === "seat-taken"));
});
