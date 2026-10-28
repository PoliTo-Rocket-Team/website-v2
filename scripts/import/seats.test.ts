import "@/lib/dashboard/access-matrix/install";
import assert from "node:assert/strict";
import { test } from "node:test";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { departments, members, roles } from "@/db/schema";
import { addRows, resetDatabase, tableRows, testDb } from "@/lib/dashboard/access-matrix/test-database";
import { yearSheetOf } from "./columns";
import { failureLines } from "./failure";
import { planImport, type Plan } from "./plan";
import { NO_DATABASE, readSnapshot, type ImportDb, type Snapshot } from "./snapshot";
import type { Sources } from "./sources";
import type { UnitRef } from "./unit-book";
import type { Units } from "./units";
import { writePlan } from "./write";

// The seat rules of issue #824, over an in-memory fake roster: a "Head of
// <division>" title leads that division, the dry run's seat check counts every
// seat the unique indexes of migration 0062 guard (in units the run creates
// too), and a failed run prints the database error's cause chain. The writes
// go to the in-memory Postgres every migration built. Every name is invented.

type Cells = Readonly<Record<string, string>>;

const db = testDb as unknown as ImportDb;
const TODAY = "2026-03-15";

/** A fake source set with one sheet per academic year, its rows from row 2. */
function sourcesOf(years: Readonly<Record<number, readonly Cells[]>>): Sources {
  const sheets = Object.entries(years)
    .map(([y, rows]) => {
      const year = Number(y);
      const sheet = `${year}-${year + 1}`;
      const blank = Object.fromEntries(Object.keys(yearSheetOf(year)).map((k) => [k, ""]));
      return { year, sheet, rows: rows.map((value, i) => ({ at: { file: "roster.xlsx", sheet, row: i + 2 }, value: { ...blank, ...value } })) };
    })
    .sort((a, b) => b.year - a.year);
  return {
    read: [],
    skipped: [],
    currentYear: sheets[0]?.year ?? null,
    years: sheets,
    quitters: [],
    rolesSheets: [],
    namelessRows: 0,
    csv: { people: [], teamMembers: [], subteams: [], divisions: [], advisors: [], orders: [], faqs: [], overrides: [] },
    titleOverrides: 0,
    conflicts: [],
  } as never;
}

const person = (first: string, last: string, cells: Cells): Cells => ({
  firstName: first,
  lastName: last,
  personalEmail: `${first}.${last}@example.com`.toLowerCase(),
  title: "Engineer",
  ...cells,
});

const databaseWith = (units: Units): Snapshot => ({ ...NO_DATABASE, units });
const EMPTY_DATABASE = databaseWith({ departments: [], divisions: [] });

/** A unit as a role names it: `#id` for one the database holds, the name of one the plan creates. */
const nameOf = (plan: Plan, level: "departments" | "divisions", ref: UnitRef | null) =>
  ref === null ? "null" : ref.kind === "existing" ? `#${ref.id}` : plan[level][ref.index].name;

/** A plan's roles as text: title, type, full access, division / department, and whether active. */
const rolesOf = (plan: Plan) =>
  plan.roles.map(
    (r) => `${r.title} | ${r.type} ${r.fullAccess ?? "-"} | ${nameOf(plan, "divisions", r.division)} / ${nameOf(plan, "departments", r.dept)}${r.leavedAt === null ? " | active" : ""}`,
  );

const seatTaken = (plan: Plan) => plan.conflicts.filter((c) => c.kind === "seat-taken").map((c) => [c.at.sheet, c.at.row]);

test("issue #824: a 'Head of <X>' whose X names a division and no department leads that division, keeping its title; one whose X names a department heads it", () => {
  // Created by this run: a row's Division cell names Safety under Operations.
  const created = planImport(
    sourcesOf({
      2025: [
        person("Ada", "Bini", { subteam: "Operations (OPS)", division: "Safety" }),
        person("Ben", "Cori", { subteam: "Operations (OPS)", title: "Head of Safety" }),
        // "<X> Head", on a row that names no unit, and the plural spelling of a division.
        person("Cia", "Dani", { subteam: "N/A", division: "N/A", title: "Safety Head" }),
        person("Gea", "Holm", { subteam: "Propulsion", division: "Valve" }),
        person("Ivo", "Lupi", { subteam: "Propulsion", title: "Head of Valves" }),
        // X names a department: its head seat.
        person("Dea", "Elmi", { subteam: "Propulsion", title: "Head of Propulsion" }),
        // X names no unit: the head seat of the row's department, as before.
        person("Eva", "Fano", { subteam: "Structures", title: "Head of Telemetry" }),
        // "Head of Department" names no unit.
        person("Fil", "Gaia", { subteam: "Recovery", title: "Head of Department" }),
      ],
    }),
    EMPTY_DATABASE,
    null,
    TODAY,
  );
  assert.deepEqual(rolesOf(created), [
    "Engineer | core - | Safety / Operations | active",
    "Head of Safety | lead - | Safety / Operations | active",
    "Safety Head | lead - | Safety / Operations | active",
    "Engineer | core - | Valve / Propulsion | active",
    "Head of Valves | lead - | Valve / Propulsion | active",
    "Head of Propulsion | head - | null / Propulsion | active",
    "Head of Telemetry | head - | null / Structures | active",
    "Head of Department | head - | null / Recovery | active",
  ]);
  assert.deepEqual(seatTaken(created), []);

  // Held by the database, found by its code; a department of the same name keeps the seat a head's.
  const database = databaseWith({
    departments: [
      { id: 3, name: "Operations", code: "OPS" },
      { id: 4, name: "Logistics", code: "LOG" },
    ],
    divisions: [
      { id: 30, name: "Safety", code: "SAF", deptId: 3 },
      { id: 40, name: "Logistics", code: null, deptId: 3 },
    ],
  });
  const stored = planImport(
    sourcesOf({
      2025: [
        person("Ada", "Bini", { subteam: "Operations (OPS)", title: "Head of SAF" }),
        person("Ben", "Cori", { subteam: "Logistics", title: "Head of Logistics" }),
      ],
    }),
    database,
    null,
    TODAY,
  );
  assert.deepEqual(rolesOf(stored), ["Head of SAF | lead - | #30 / #3 | active", "Head of Logistics | head - | null / #4 | active"]);
});

test("issue #824: the seat check counts every seat a 0062 index guards, in units the run creates and in existing ones; the later row's role is refused", () => {
  const created = planImport(
    sourcesOf({
      2025: [
        // The Chief Operating Officer holds operations_lead and the head seat of Operations, created by this run.
        person("Ada", "Bini", { subteam: "Operations (OPS)", title: "Chief Operating Officer" }),
        person("Ben", "Cori", { subteam: "Operations (OPS)", title: "Head of Department" }),
        // Two heads of Fluids, created by this run.
        person("Cia", "Dani", { subteam: "Fluids", title: "Head of Department" }),
        person("Dea", "Elmi", { subteam: "Fluids", title: "Fluids Head" }),
        // Two team leaders.
        person("Eva", "Fano", { subteam: "N/A", division: "N/A", title: "President" }),
        person("Fil", "Gaia", { subteam: "N/A", division: "N/A", title: "Team Leader" }),
        // Two IT leads in a division this run creates.
        person("Gea", "Holm", { subteam: "Operations (OPS)", division: "Information Technology", title: "IT Lead" }),
        person("Ivo", "Lupi", { subteam: "Operations (OPS)", division: "Information Technology", title: "IT Division Lead" }),
      ],
      // Past holders of one seat are no clash.
      2024: [person("Lia", "Mori", { subteam: "Fluids", title: "Head of Department" })],
    }),
    EMPTY_DATABASE,
    null,
    TODAY,
  );
  assert.deepEqual(seatTaken(created), [
    ["2025-2026", 3],
    ["2025-2026", 5],
    ["2025-2026", 7],
    ["2025-2026", 9],
  ]);
  assert.equal(created.counts.roles.refused, 4);
  assert.deepEqual(rolesOf(created).filter((r) => r.endsWith("active")), [
    "Chief Operating Officer | head operations_lead | null / Operations | active",
    "Head of Department | head - | null / Fluids | active",
    "President | president - | null / null | active",
    "IT Lead | lead it_lead | Information Technology / Operations | active",
  ]);

  // The same clash in a department the database holds; the Chief Operating Officer's row names none.
  const stored = planImport(
    sourcesOf({
      2025: [
        person("Ada", "Bini", { subteam: "N/A", division: "N/A", title: "Chief Operating Officer" }),
        person("Ben", "Cori", { subteam: "OPS", title: "Head of Department" }),
      ],
    }),
    databaseWith({ departments: [{ id: 3, name: "Operations", code: "OPS" }], divisions: [] }),
    null,
    TODAY,
  );
  assert.deepEqual(seatTaken(stored), [["2025-2026", 3]]);
  assert.deepEqual(rolesOf(stored), ["Chief Operating Officer | head operations_lead | null / #3 | active"]);
});

test("issue #824: a Chief Operating Officer and a 'Head of <division>' in one created department import with no constraint error; a refused clash writes nothing for its role", async () => {
  await resetDatabase();
  const sources = sourcesOf({
    2025: [
      person("Ada", "Bini", { subteam: "Operations (OPS)", title: "Head of Safety" }),
      person("Ben", "Cori", { subteam: "Operations (OPS)", division: "Safety" }),
      person("Cia", "Dani", { subteam: "Operations (OPS)", title: "Chief Operating Officer" }),
      person("Dea", "Elmi", { subteam: "Operations (OPS)", title: "Head of Department" }),
    ],
  });
  const plan = planImport(sources, await readSnapshot(db), null, TODAY);
  assert.deepEqual(seatTaken(plan), [["2025-2026", 5]]);
  await db.transaction((tx) => writePlan(tx, plan, null));
  const written = (await tableRows(roles)) as (typeof roles.$inferSelect)[];
  assert.deepEqual(
    written.map((r) => [r.title, r.type, r.fullAccess, r.deptId !== null, r.divisionId !== null, r.leavedAt]).sort(),
    [
      ["Chief Operating Officer", "head", "operations_lead", true, false, null],
      ["Engineer", "core", null, true, true, null],
      ["Head of Safety", "lead", null, true, true, null],
    ].sort(),
  );
});

test("issue #824: a failed write prints the database error's cause chain (code, constraint, table, column, first message line) and never the query parameters", async () => {
  await resetDatabase();
  await addRows(departments, [{ id: 7, name: "Fluids", code: "FLD" }]);
  await addRows(members, [{ memberId: 70 }, { memberId: 71 }]);
  const heads = [70, 71].map((memberId) => ({ memberId, deptId: 7, title: "Secret Seat Title", type: "head" as const, startedAt: "2025-10-01" }));
  const clash = await testDb.insert(roles).values(heads).then(
    () => assert.fail("two active heads of one department are refused"),
    (error: unknown) => error,
  );
  const lines = failureLines(clash);
  assert.ok(lines.length >= 2, "the wrapper and its cause");
  assert.match(lines[0], /^Failed query: insert into "roles"/);
  assert.match(lines.at(-1)!, /^caused by: duplicate key value violates unique constraint .* \(code 23505, constraint roles_one_active_department_head, table roles\)$/);
  assert.ok(!lines.join("\n").includes("Secret Seat Title"), "no parameter is printed");

  const missing = await testDb
    .insert(roles)
    .values({ memberId: 70, title: null } as never)
    .then(
      () => assert.fail("a role with no title is refused"),
      (error: unknown) => error,
    );
  assert.match(failureLines(missing).at(-1)!, /\(code 23502, table roles, column title\)$/);

  // postgres-js names the fields `constraint_name`, `table_name`, `column_name`; a detail is never printed.
  const driver = Object.assign(new Error("duplicate key value violates unique constraint \"roles_one_active_full_access_seat\"\nsecond line"), {
    code: "23505",
    constraint_name: "roles_one_active_full_access_seat",
    table_name: "roles",
    detail: "Key (full_access)=(it_lead) already exists.",
  });
  assert.deepEqual(failureLines(new DrizzleQueryError("insert into \"roles\" values ($1)", ["Private Value"], driver)), [
    'Failed query: insert into "roles" values ($1)',
    'caused by: duplicate key value violates unique constraint "roles_one_active_full_access_seat" (code 23505, constraint roles_one_active_full_access_seat, table roles)',
  ]);
  assert.deepEqual(failureLines("plain text"), ["plain text"]);
});
