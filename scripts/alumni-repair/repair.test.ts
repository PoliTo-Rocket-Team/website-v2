import assert from "node:assert/strict";
import { test } from "node:test";
import { departments, divisions, members, roles, users } from "@/db/schema";
import { addRows, databaseWrites, restore, tableRows, testDb } from "@/lib/dashboard/access-matrix/test-database";
import { afterWrite, failureReport } from "./failure";
import { groupDivisions } from "./lineage";
import { lastYearOf } from "./quitters";
import { rosterOf, type QuitterRow } from "./roster";
import { runRepair } from "./run";
import type { RepairDb } from "./snapshot";

// The alumni repair (issue #913) over a fake roster built in memory and the
// in-memory Postgres every migration in drizzle/ built. Every name is
// invented and every email is on example.com.

const db = testDb as unknown as RepairDb;

const LIQUID = 9101;
const EFESTO = 9102;
const PROPULSION = 9103;
const ELECTRONICS = 9104;
const INJECTORS = 9201;
const CYCLE_EFESTO = 9202;
const CYCLE_PROPULSION = 9203;
const TCA = 9204;
const HARDWARE = 9205;
const FEED = 9206;

const ANNA = 9301; // on 2024-2025, left in 2025-2026: her last year is missing
const BRUNO = 9302; // left in 2024-2025 and already has a role that year
const CARLA = 9303; // on 2025-2026, the year she left in
const ELIO = 9305; // on 2022-2023, left in 2023-2024 from Liquid Propulsion

const QUITTERS_HEADER = ["First Name", "Last Name", "Personal Mail", "Subteam", "Division", "Team Title Official", "Left the Team on:", "Joined the Team on:"];
const YEAR_HEADER = ["First Name", "Last Name", "Personal Mail"];

const ROSTER = rosterOf([
  { name: "2025-2026", rows: [YEAR_HEADER, ["Carla", "Example", "carla@example.com"]] },
  { name: "2024-2025", rows: [YEAR_HEADER, ["Anna", "Example", "anna@example.com"]] },
  { name: "2023-2024", rows: [YEAR_HEADER, ["Bruno", "Example", "bruno@example.com"], ["Fabio", "Example", "fabio@example.com"]] },
  { name: "2022-2023", rows: [YEAR_HEADER, ["Elio", "Example", "elio@example.com"]] },
  {
    name: "Quitters",
    rows: [
      ["Quitters of the team"],
      QUITTERS_HEADER,
      // Row 3: Anna, her emails in another case; Propulsion as the workbook spells it today.
      ["Anna", "Example", "ANNA@Example.com", "Propulsion (PRO)", "Thrust Chamber Assembly", "Software  Engineer", "15/03/2026", "01/10/2023"],
      // Row 4: Bruno, who already has a 2024-2025 role.
      ["Bruno", "Example", "bruno@example.com", "Electronics", "Hardware", "Hardware Engineer", "10/01/2025", ""],
      // Row 5: Carla, on the sheet of the year she left in.
      ["Carla", "Example", "carla@example.com", "Propulsion", "Thrust Chamber Assembly", "Engineer", "01/02/2026", ""],
      // Row 6: on no year sheet: the import placed her.
      ["Dora", "Example", "dora@example.com", "Electronics", "Hardware", "Engineer", "01/02/2024", ""],
      // Row 7: Elio, from Liquid Propulsion in 2023-2024, joined after the year began.
      ["Elio", "Example", "elio@example.com", "Liquid Propulsion", "Injectors", "Injector Lead", "20/05/2024", "15/11/2023"],
      // Row 8: on a year sheet by name, but no member in the database has his email.
      ["Fabio", "Example", "fabio@example.com", "Electronics", "Hardware", "Engineer", "01/03/2025", ""],
    ],
  },
  { name: "2026-2027", rows: [YEAR_HEADER] },
  { name: "Stats", rows: [["anything"]] },
]);

async function world(): Promise<void> {
  await restore("alumni-repair-world", async () => {
    await addRows(departments, [
      { id: LIQUID, name: "Liquid Propulsion", code: "LPR", closedAt: "2024-09-30" },
      { id: EFESTO, name: "Efesto", code: "EFS", closedAt: "2025-09-30" },
      { id: PROPULSION, name: "Propulsion", code: "PRO" },
      { id: ELECTRONICS, name: "Electronics", code: "ELT" },
    ]);
    await addRows(divisions, [
      { id: INJECTORS, deptId: LIQUID, name: "Injectors", code: "INJ" },
      { id: CYCLE_EFESTO, deptId: EFESTO, name: "Engine Cycle", code: "ENC" },
      { id: CYCLE_PROPULSION, deptId: PROPULSION, name: "Engine Cycles", code: "ENC" },
      { id: TCA, deptId: PROPULSION, name: "Thrust Chamber Assembly", code: "TCA" },
      { id: HARDWARE, deptId: ELECTRONICS, name: "Hardware", code: "HDW" },
      { id: FEED, deptId: EFESTO, name: "Feed System", code: "FDS" },
    ]);
    await addRows(members, [{ memberId: ANNA }, { memberId: BRUNO }, { memberId: CARLA }, { memberId: ELIO }]);
    await addRows(users, [
      { id: "imported:anna", email: "anna@example.com", member: ANNA },
      { id: "imported:bruno", email: "bruno@example.com", member: BRUNO },
      { id: "imported:carla", email: "carla@example.com", member: CARLA },
      { id: "imported:elio", email: "elio@example.com", member: ELIO },
    ]);
    await addRows(roles, [
      // Anna's 2024-2025 role, under Efesto: the lineage moves it to Propulsion.
      { id: 9401, memberId: ANNA, deptId: EFESTO, divisionId: CYCLE_EFESTO, title: "Engineer", type: "core", startedAt: "2024-10-01", leavedAt: "2025-09-30" },
      { id: 9402, memberId: BRUNO, deptId: ELECTRONICS, divisionId: HARDWARE, title: "Engineer", type: "core", startedAt: "2023-10-01", leavedAt: "2024-09-30" },
      { id: 9403, memberId: BRUNO, deptId: ELECTRONICS, divisionId: HARDWARE, title: "Engineer", type: "core", startedAt: "2024-10-01", leavedAt: "2025-01-10" },
      { id: 9404, memberId: CARLA, deptId: PROPULSION, divisionId: TCA, title: "Engineer", type: "core", startedAt: "2025-10-01", leavedAt: "2026-02-01" },
      // Elio's 2022-2023 role under Liquid Propulsion: the lineage moves it to Efesto, which has no Injectors yet.
      { id: 9405, memberId: ELIO, deptId: LIQUID, divisionId: INJECTORS, title: "Engineer", type: "core", startedAt: "2022-10-01", leavedAt: "2023-09-30" },
      // A 2025-2026 role under Efesto's Feed System: Propulsion has no Feed System.
      { id: 9406, memberId: CARLA, deptId: EFESTO, divisionId: FEED, title: "Engineer", type: "core", startedAt: "2025-10-01", leavedAt: "2026-01-15" },
      // A 2021-2022 role under Propulsion with no division: it belongs under Efesto.
      { id: 9407, memberId: ELIO, deptId: PROPULSION, divisionId: null, title: "Engineer", type: "core", startedAt: "2021-10-01", leavedAt: "2022-09-30" },
      // A 2023-2024 Efesto role is already where it belongs.
      { id: 9408, memberId: CARLA, deptId: EFESTO, divisionId: CYCLE_EFESTO, title: "Engineer", type: "core", startedAt: "2023-10-01", leavedAt: "2023-12-01" },
    ]);
  });
}

type Role = typeof roles.$inferSelect;
const allRoles = async () => (await tableRows(roles)) as Role[];
const shape = (r: Role) => [r.memberId, r.deptId, r.divisionId, r.title, r.type, r.fullAccess, r.startedAt, r.leavedAt];

test("a dry run lists each role to add and to move by row and unit, prints no personal value, and writes nothing", async () => {
  await world();
  const { plan, report } = await runRepair({ mode: "dry-run", file: "roster.xlsx", roster: ROSTER, db });
  assert.deepEqual(await databaseWrites(), []);
  assert.equal(plan.roles.length, 2);
  assert.match(report, /^ {2}Quitters row 3: 2025-2026, Propulsion › Thrust Chamber Assembly$/m);
  assert.match(report, /^ {2}Quitters row 7: 2023-2024, Efesto › Injectors \(new\)$/m);
  assert.match(report, /^ {2}\[has-role\] Quitters row 4: /m);
  assert.match(report, /^ {2}\[no-member\] Quitters row 8: /m);
  assert.match(report, /^ {2}on no year sheet \(the import placed them\): 1$/m);
  assert.match(report, /^ {2}on the year sheet of their leave year: 1$/m);
  assert.match(report, /^Roles to move: 4$/m);
  assert.match(report, /^ {2}2024-2025: Efesto › Engine Cycle → Propulsion › Engine Cycles: 1 role$/m);
  assert.match(report, /^ {2}division Injectors \(INJ\) under Efesto: closed, 2022-10-01 to 2024-09-30$/m);
  assert.match(report, /^ {2}division Feed System \(FDS\) under Propulsion: closed, 2025-10-01 to 2026-09-30$/m);
  for (const personal of ["Anna", "Bruno", "Carla", "Dora", "Elio", "Fabio", "example.com", "9301", "9401"]) assert.doesNotMatch(report, new RegExp(personal, "i"));
});

test("a real run adds the missing last-year role from the Quitters row, skips a year that has a role, and moves the lineage", async () => {
  await world();
  const before = await allRoles();
  const { written } = await runRepair({ mode: "repair", file: "roster.xlsx", roster: ROSTER, db });
  assert.deepEqual(written, { divisions: 2, roles: 2, moves: 4 });
  const after = await allRoles();
  // No role is deleted.
  for (const r of before) assert.ok(after.some((a) => a.id === r.id), `role ${r.id} is kept`);
  const added = after.filter((r) => !before.some((b) => b.id === r.id));
  const created = (await tableRows(divisions)).filter((d) => (d.id as number) > FEED);
  const injectors = created.find((d) => d.name === "Injectors");
  const feed = created.find((d) => d.name === "Feed System");
  assert.deepEqual(
    created.map((d) => [d.deptId, d.name, d.code, d.startedAt, d.closedAt]),
    [
      [EFESTO, "Injectors", "INJ", "2022-10-01", "2024-09-30"],
      [PROPULSION, "Feed System", "FDS", "2025-10-01", "2026-09-30"],
    ],
  );
  // Anna: one ended 2025-2026 role, title as written, from the year's start (her join day is earlier) to her leave day.
  // Elio: his 2023-2024 role starts on his later join day, under Efesto (the lineage), in the new closed Injectors.
  assert.deepEqual(added.map(shape), [
    [ANNA, PROPULSION, TCA, "Software Engineer", "core", null, "2025-10-01", "2026-03-15"],
    [ELIO, EFESTO, injectors!.id, "Injector Lead", "lead", null, "2023-11-15", "2024-05-20"],
  ]);
  // Bruno already had a role in 2024-2025, and Carla is on her leave year's sheet: nothing added for them.
  assert.equal(after.filter((r) => r.memberId === BRUNO).length, 2);
  assert.equal(after.filter((r) => r.memberId === CARLA).length, 3);
  const placeOf = (id: number) => {
    const r = after.find((x) => x.id === id)!;
    return [r.deptId, r.divisionId];
  };
  assert.deepEqual(placeOf(9401), [PROPULSION, CYCLE_PROPULSION]);
  assert.deepEqual(placeOf(9405), [EFESTO, injectors!.id]);
  assert.deepEqual(placeOf(9406), [PROPULSION, feed!.id]);
  assert.deepEqual(placeOf(9407), [EFESTO, null]);
  assert.deepEqual(placeOf(9408), [EFESTO, CYCLE_EFESTO]);
  // Only the lineage's dept_id and division_id changed on the moved roles.
  for (const id of [9401, 9405, 9406, 9407]) {
    const [b, a] = [before.find((r) => r.id === id)!, after.find((r) => r.id === id)!];
    assert.deepEqual([a.memberId, a.title, a.type, a.startedAt, a.leavedAt], [b.memberId, b.title, b.type, b.startedAt, b.leavedAt]);
  }
  // Inserts and updates only: no department, no delete.
  const kinds = new Set((await databaseWrites()).map((w) => `${w.kind} ${w.table}`));
  assert.deepEqual([...kinds].sort(), ["insert divisions", "insert roles", "update roles"]);
});

test("a second real run changes nothing", async () => {
  await world();
  await runRepair({ mode: "repair", file: "roster.xlsx", roster: ROSTER, db });
  const [rolesAfterFirst, divisionsAfterFirst] = [await allRoles(), await tableRows(divisions)];
  const { plan, written } = await runRepair({ mode: "repair", file: "roster.xlsx", roster: ROSTER, db });
  assert.deepEqual(written, { divisions: 0, roles: 0, moves: 0 });
  assert.deepEqual([plan.roles.length, plan.moves.length, plan.divisions.length], [0, 0, 0]);
  assert.ok(plan.skipped.some((s) => s.kind === "has-role" && s.at.row === 3), "Anna's row now finds her 2025-2026 role");
  assert.deepEqual(await allRoles(), rolesAfterFirst);
  assert.deepEqual(await tableRows(divisions), divisionsAfterFirst);
});

test("two source divisions with different names and one code, missing from the target, share one created division", async () => {
  const [VALVES, VALVE_SYSTEMS] = [9211, 9212];
  await restore("alumni-repair-shared-code", async () => {
    await addRows(departments, [
      { id: LIQUID, name: "Liquid Propulsion", code: "LPR", closedAt: "2024-09-30" },
      { id: EFESTO, name: "Efesto", code: "EFS", closedAt: "2025-09-30" },
      { id: PROPULSION, name: "Propulsion", code: "PRO" },
    ]);
    await addRows(divisions, [
      { id: VALVES, deptId: LIQUID, name: "Valves", code: "VLV" },
      { id: VALVE_SYSTEMS, deptId: EFESTO, name: "Valve Systems", code: "vlv" },
    ]);
    await addRows(members, [{ memberId: ANNA }, { memberId: BRUNO }]);
    await addRows(roles, [
      { id: 9411, memberId: ANNA, deptId: LIQUID, divisionId: VALVES, title: "Engineer", type: "core", startedAt: "2024-10-01", leavedAt: "2025-09-30" },
      { id: 9412, memberId: BRUNO, deptId: EFESTO, divisionId: VALVE_SYSTEMS, title: "Engineer", type: "core", startedAt: "2025-10-01", leavedAt: "2026-06-30" },
    ]);
  });
  const { written } = await runRepair({ mode: "repair", file: "roster.xlsx", roster: ROSTER, db });
  assert.deepEqual(written, { divisions: 1, roles: 0, moves: 2 });
  const created = (await tableRows(divisions)).filter((d) => d.deptId === PROPULSION);
  assert.deepEqual(
    created.map((d) => [d.name, d.code, d.startedAt, d.closedAt]),
    [["Valves", "VLV", "2024-10-01", "2026-09-30"]],
  );
  const moved = (await allRoles()).filter((r) => r.id === 9411 || r.id === 9412);
  assert.deepEqual(
    moved.map((r) => [r.deptId, r.divisionId]),
    [
      [PROPULSION, created[0].id],
      [PROPULSION, created[0].id],
    ],
  );
  // The created division matches both by code, so a second run plans nothing.
  const again = await runRepair({ mode: "repair", file: "roster.xlsx", roster: ROSTER, db });
  assert.deepEqual(again.written, { divisions: 0, roles: 0, moves: 0 });
});

// A chain: "Alpha"/X and "Alpha"/Y share a name, "Alpha"/Y and "Beta"/y share a code. None is in Propulsion.
const CHAIN = [
  { id: 9221, deptId: LIQUID, name: "Alpha", code: "X", year: 2024 },
  { id: 9222, deptId: EFESTO, name: "Alpha", code: "Y", year: 2025 },
  { id: 9223, deptId: LIQUID, name: "Beta", code: "y", year: 2024 },
] as const;

test("source divisions chained by name and code fall in one group, whatever order they come in", () => {
  const other = { id: 9224, deptId: EFESTO, name: "Gamma", code: "Z" };
  const all = [...CHAIN.map(({ year: _year, ...d }) => d), other];
  const orders = (xs: readonly (typeof all)[number][]): (typeof all)[number][][] =>
    xs.length <= 1 ? [[...xs]] : xs.flatMap((x, i) => orders([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
  for (const order of orders(all)) {
    assert.deepEqual(
      groupDivisions(order).map((g) => g.map((d) => d.id)),
      [[9221, 9222, 9223], [9224]],
      `read in the order ${order.map((d) => d.id).join(", ")}`,
    );
  }
});

for (const [label, order] of [
  ["name first, then code", [9221, 9222, 9223]],
  ["code first, then name", [9223, 9222, 9221]],
] as const) {
  test(`source divisions chained by a shared name and a shared code share one created division (roles read ${label})`, async () => {
    await restore(`alumni-repair-chain-${order[0]}`, async () => {
      await addRows(departments, [
        { id: LIQUID, name: "Liquid Propulsion", code: "LPR", closedAt: "2024-09-30" },
        { id: EFESTO, name: "Efesto", code: "EFS", closedAt: "2025-09-30" },
        { id: PROPULSION, name: "Propulsion", code: "PRO" },
      ]);
      await addRows(
        divisions,
        CHAIN.map(({ year: _year, ...d }) => d),
      );
      await addRows(members, [{ memberId: ANNA }]);
      // Roles are read in id order, so the role ids set the order the divisions are met in.
      await addRows(
        roles,
        order.map((divisionId, i) => {
          const d = CHAIN.find((c) => c.id === divisionId)!;
          return { id: 9421 + i, memberId: ANNA, deptId: d.deptId, divisionId, title: "Engineer", type: "core" as const, startedAt: `${d.year}-10-01`, leavedAt: `${d.year + 1}-06-30` };
        }),
      );
    });
    const { written } = await runRepair({ mode: "repair", file: "roster.xlsx", roster: ROSTER, db });
    assert.deepEqual(written, { divisions: 1, roles: 0, moves: 3 });
    const created = (await tableRows(divisions)).filter((d) => d.deptId === PROPULSION);
    // Named after the group's lowest id, its span over every role's year: the same in both orders.
    assert.deepEqual(
      created.map((d) => [d.name, d.code, d.startedAt, d.closedAt]),
      [["Alpha", "X", "2024-10-01", "2026-09-30"]],
    );
    const moved = (await allRoles()).filter((r) => r.id >= 9421 && r.id <= 9423);
    assert.deepEqual(
      moved.map((r) => [r.deptId, r.divisionId]),
      [0, 1, 2].map(() => [PROPULSION, created[0].id]),
    );
    const again = await runRepair({ mode: "repair", file: "roster.xlsx", roster: ROSTER, db });
    assert.deepEqual(again.written, { divisions: 0, roles: 0, moves: 0 });
  });
}

test("a failure in any step after a real run's commit, rendering the report included, says the repair was written", async () => {
  const reportOf = (error: unknown) => failureReport(error);
  // Rendering the report runs inside the run, after the commit: a roster the report cannot render fails it there.
  await world();
  const unrenderable = { ...ROSTER, read: { join: () => { throw new Error("cannot render"); } } as unknown as readonly string[] };
  const rendering = await runRepair({ mode: "repair", file: "roster.xlsx", roster: unrenderable, db }).then(() => "no failure", reportOf);
  assert.match(rendering, /^Alumni repair was written: its transaction committed\. Then rendering the report failed\.\n {2}cannot render$/);
  assert.equal((await allRoles()).filter((r) => r.memberId === ANNA).length, 2, "Anna's added role is written");

  // The caller's steps run inside the run too: the first that fails is named, and none after it runs.
  await world();
  const ran: string[] = [];
  const writing = await runRepair({ mode: "repair", file: "roster.xlsx", roster: ROSTER, db }, [
    { name: "printing the report", act: ({ report }) => void ran.push(report.includes("Workbook: roster.xlsx") ? "printed" : "empty") },
    {
      name: "writing the report file",
      act: () => {
        throw new Error("EACCES: permission denied");
      },
    },
    { name: "closing the database connection", act: () => void ran.push("closed") },
  ]).then(() => "no failure", reportOf);
  assert.match(writing, /^Alumni repair was written: its transaction committed\. Then writing the report file failed\.\n {2}EACCES: permission denied$/);
  assert.deepEqual(ran, ["printed"]);
  assert.equal((await allRoles()).filter((r) => r.memberId === ANNA).length, 2, "Anna's added role is written");

  // A dry run commits nothing, so the same failure says nothing was written.
  await world();
  const dry = await runRepair({ mode: "dry-run", file: "roster.xlsx", roster: ROSTER, db }, [
    {
      name: "writing the report file",
      act: () => {
        throw new Error("EACCES: permission denied");
      },
    },
  ]).then(() => "no failure", reportOf);
  assert.match(dry, /^Alumni repair failed; nothing was written\./);
  assert.deepEqual(await databaseWrites(), []);
});

test("a failed run says nothing was written only before its commit; after it, it says the repair was written and what failed", async () => {
  const before = failureReport(new Error("connection refused"));
  assert.match(before, /^Alumni repair failed; nothing was written\.\n {2}connection refused$/);
  const after = await afterWrite("writing the report file", () => {
    throw new Error("EACCES: permission denied");
  }).catch((error: unknown) => failureReport(error));
  assert.match(after, /^Alumni repair was written: its transaction committed\. Then writing the report file failed\.\n {2}EACCES: permission denied$/);
  assert.doesNotMatch(after, /nothing was written/);
  assert.equal(await afterWrite("closing the database connection", () => 7), 7);
});

test("a run with no single Efesto or Propulsion department refuses and writes nothing", async () => {
  await restore("alumni-repair-no-lineage", async () => {
    await addRows(departments, [{ id: PROPULSION, name: "Propulsion", code: "PRO" }]);
  });
  await assert.rejects(runRepair({ mode: "repair", file: "roster.xlsx", roster: ROSTER, db }), /exactly one "Efesto" and one "Propulsion"/);
  assert.deepEqual(await databaseWrites(), []);
});

test("a Quitters row's last year reads its dates day first, swaps a date cell stored month/day, and starts no earlier than the year", () => {
  const row = (leftOn: string, joinedOn: string): QuitterRow => ({
    at: { sheet: "Quitters", row: 2 },
    value: { firstName: "A", lastName: "B", personalEmail: "", studentEmail: "", phdEmail: "", prtEmail: "", subteam: "", division: "", title: "", leftOn, joinedOn },
  });
  assert.deepEqual(lastYearOf(row("15/03/2026", "01/10/2023")), { kind: "last-year", year: 2025, startedAt: "2025-10-01", leftAt: "2026-03-15", swapped: null });
  assert.deepEqual(lastYearOf(row("2026-03-15", "2025-11-02")), { kind: "last-year", year: 2025, startedAt: "2025-11-02", leftAt: "2026-03-15", swapped: null });
  // 46025 is the date cell 2026-01-03, stored month/day: read swapped, it is 1 March 2026, after the join day.
  assert.deepEqual(lastYearOf(row("46025", "15/02/2026")), { kind: "last-year", year: 2025, startedAt: "2026-02-15", leftAt: "2026-03-01", swapped: "leftOn" });
  assert.deepEqual(lastYearOf(row("", "")), { kind: "unclear", reason: "no-leave-date", field: "leftOn" });
  assert.deepEqual(lastYearOf(row("31/02/2026", "")), { kind: "unclear", reason: "date-unreadable", field: "leftOn" });
});
