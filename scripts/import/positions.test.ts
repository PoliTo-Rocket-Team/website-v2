import "@/lib/dashboard/access-matrix/install";
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { applyPositions, departments, divisions, faqs, members, users } from "@/db/schema";
import { addRows, databaseWrites, restore, tableRows, testDb } from "@/lib/dashboard/access-matrix/test-database";
import { isTestDivision, listOf, matchDivision, type PositionOutcome } from "./positions";
import { runPositionsImport } from "./run";
import type { ImportDb } from "./snapshot";
import type { Division } from "./units";

// The positions-only run (issue #834) over the fake exports in
// ./fixtures/positions (make-fixtures.ts says what each line plants), on the
// in-memory Postgres every migration in drizzle/ built. The test lays the
// divisions a production database holds; the run must create none.

const FILES = join(__dirname, "fixtures", "positions");
const db = testDb as unknown as ImportDb;
const [LIQUID_SYSTEMS, GROUND_SYSTEMS, INFORMATION_TECHNOLOGY, RECOVERY, MISSION_ANALYSIS] = [1, 2, 3, 8, 9];

async function world(): Promise<void> {
  await restore("positions-import-world", async () => {
    await addRows(departments, [
      { id: 1, name: "Propulsion", code: "PRP" },
      { id: 2, name: "Operations", code: "OPS", kind: "operations" },
      { id: 3, name: "Avionics", code: "AVI" },
    ]);
    await addRows(divisions, [
      { id: LIQUID_SYSTEMS, deptId: 1, name: "Liquid Systems", code: "LQS" },
      { id: GROUND_SYSTEMS, deptId: 1, name: "Ground Systems", code: "GNS" },
      { id: INFORMATION_TECHNOLOGY, deptId: 2, name: "Information Technology", code: "ITC" },
      { id: 4, deptId: 2, name: "Safety", code: "SFT" },
      { id: 5, deptId: 3, name: "Safety", code: "SAF" },
      { id: 6, deptId: 3, name: "Flight Software", code: "FSW" },
      { id: 7, deptId: 3, name: "Flight Computers", code: "FSW" },
      { id: RECOVERY, deptId: 3, name: "Recovery", code: "REC" },
      { id: MISSION_ANALYSIS, deptId: 3, name: "Mission Analysis", code: "MSA", startedAt: "2022-10-01", closedAt: "2024-09-30" },
    ]);
  });
}

/** Each row's line and what the run does with it, and the division it maps to when it maps to one. */
const byLine = (outcomes: readonly PositionOutcome[]) =>
  outcomes.map((o) => [o.at.row, o.kind, "match" in o ? o.match.division.id : null, "match" in o ? o.match.by : null]);

const EXPECTED = [
  [2, "insert", LIQUID_SYSTEMS, "code"],
  [3, "insert", GROUND_SYSTEMS, "name"],
  [4, "insert", INFORMATION_TECHNOLOGY, "code"],
  [5, "duplicate", INFORMATION_TECHNOLOGY, "code"],
  [6, "insert", LIQUID_SYSTEMS, "code"],
  [7, "several-divisions", null, null],
  [8, "several-divisions", null, null],
  [9, "no-division", null, null],
  [10, "test-division", null, null],
  [11, "insert", RECOVERY, "name"],
  [12, "unknown-old-division", null, null],
  [13, "no-title", null, null],
  [14, "insert", MISSION_ANALYSIS, "code"],
];

test("a positions-only dry run maps each old division and lists every row with its production division, and writes nothing", async () => {
  await world();
  const { plan, report } = await runPositionsImport({ mode: "dry-run", directory: FILES, db });
  assert.deepEqual(await databaseWrites(), []);
  assert.deepEqual(byLine(plan.outcomes), EXPECTED);

  assert.match(report, /^Positions to insert, closed: 6$/m);
  assert.match(report, /^Duplicates of an earlier row \(same division and title\): 1$/m);
  assert.match(report, /^Test division, skipped: 1$/m);
  assert.match(report, /^Not imported, no production division: 1$/m);
  assert.match(report, /^Not imported, several production divisions: 2$/m);
  assert.match(report, /^Not imported, old division not in the export: 1$/m);
  assert.match(report, /^Not imported, no title: 1$/m);
  for (const line of [
    'positions_rows.csv › row 2: "Feed Systems Engineer" → Liquid Systems (LQS), by code, from old division Liquid Propulsion Systems (LQS): to insert',
    'positions_rows.csv › row 3: "Test Bench Operator" → Ground Systems (GNS), by name, from old division Ground System: to insert',
    'positions_rows.csv › row 5: "web  developer" → Information Technology (ITC), by code, from old division IT & Communication (ITC): duplicate of row 4, not imported',
    'positions_rows.csv › row 11: "Recovery Engineer" → Recovery (REC), by name, from old division Recovery (RCV): to insert',
    "positions_rows.csv › row 7: old division Safety matches 2 production divisions (Safety (SFT); Safety (SAF)): not imported",
    "positions_rows.csv › row 8: old division Flight Software (FSW) matches 2 production divisions (Flight Software (FSW); Flight Computers (FSW)): not imported",
    "positions_rows.csv › row 9: old division Avionics Bay (AVB) matches no production division: not imported",
    "positions_rows.csv › row 10: test division test-division-website (TDW): skipped",
    "positions_rows.csv › row 12: its division id is on no row of divisions_rows.csv or subteams_rows.csv: not imported",
  ]) {
    assert.ok(report.split("\n").includes(`  ${line}`), `the report lists: ${line}`);
  }
  // It reads the three files it needs, and lists every other file as not read.
  assert.match(report, /^Read:\n {2}positions_rows\.csv\n {2}divisions_rows\.csv\n {2}subteams_rows\.csv$/m);
  assert.match(report, /^ {2}faqs_rows\.csv: not read by the positions-only run$/m);
  assert.match(report, /^ {2}people_rows\.csv: not read by the positions-only run$/m);
  assert.ok(!report.includes("Pino"), "no personal value from a file it does not read");
});

test("a positions-only import inserts each mapped position once, closed, and writes nothing else", async () => {
  await world();
  const before = await Promise.all([departments, divisions, users, members, faqs].map((t) => tableRows(t)));
  const { written, report } = await runPositionsImport({ mode: "import", directory: FILES, db });
  assert.equal(written, 6);
  assert.match(report, /^Positions inserted, closed: 6$/m);
  const writes = await databaseWrites();
  assert.ok(writes.length > 0 && writes.every((w) => w.kind === "insert" && w.table === "apply_positions"), "only positions are inserted");
  assert.deepEqual(await Promise.all([departments, divisions, users, members, faqs].map((t) => tableRows(t))), before, "no unit, person or FAQ is written");

  const rows = (await tableRows(applyPositions)) as (typeof applyPositions.$inferSelect)[];
  assert.deepEqual(
    rows.map((p) => [p.divisionId, p.title, p.status, p.description, p.requiredSkills, p.desirableSkills, p.isDeleted]),
    [
      [LIQUID_SYSTEMS, "Feed Systems Engineer", false, "Design the feed system.", ["Fluid dynamics", "Teamwork"], ["CAD", "Python"], false],
      [GROUND_SYSTEMS, "Test Bench Operator", false, null, [], [], false],
      [INFORMATION_TECHNOLOGY, "Web Developer", false, "Build the site.", [], [], false],
      [LIQUID_SYSTEMS, "Web Developer", false, "Build the bench software.", [], [], false],
      [RECOVERY, "Recovery Engineer", false, "Pack the parachutes.", [], [], false],
      [MISSION_ANALYSIS, "Mission Analyst", false, "Plan the flight.\nCheck the margins.", ["Orbital mechanics", "MATLAB"], [], false],
    ],
  );
  // The old external form id has no column to land in, and no custom question is made from it.
  assert.ok(rows.every((p) => p.customQuestions === null && !JSON.stringify(p).includes("fake-form")));
});

test("a second positions-only import inserts nothing and finds every position present", async () => {
  await world();
  await runPositionsImport({ mode: "import", directory: FILES, db });
  const after = await tableRows(applyPositions);
  const second = await runPositionsImport({ mode: "import", directory: FILES, db });
  assert.equal(second.written, 0);
  assert.deepEqual(await tableRows(applyPositions), after);
  assert.deepEqual(
    byLine(second.plan.outcomes),
    EXPECTED.map(([row, kind, ...rest]) => [row, kind === "insert" ? "present" : kind, ...rest]),
  );
  assert.match(second.report, /^Positions inserted, closed: 0$/m);
  assert.match(second.report, /^Already present: 6$/m);
});

const division = (id: number, name: string, code: string | null): Division => ({ id, name, code, deptId: null });

test("an old division maps by code first, then by name through the unit fold, and never picks among several", () => {
  const units = [division(1, "Ground Systems", "GNS"), division(2, "Aero Optimization", "AOA"), division(3, "Safety", "SFT"), division(4, "Safety", "SAF")];
  // The code wins over a name that would find another division.
  assert.deepEqual(matchDivision(units, { file: "f", name: "Safety", code: "AOA" }), { kind: "found", division: units[1], by: "code" });
  // No code match: the name, folded on case, punctuation and a plural "s".
  assert.deepEqual(matchDivision(units, { file: "f", name: "ground-system", code: "XYZ" }), { kind: "found", division: units[0], by: "name" });
  assert.deepEqual(matchDivision(units, { file: "f", name: "Ground System Division", code: null }), { kind: "found", division: units[0], by: "name" });
  // A bare name equal to a code finds that code's division.
  assert.deepEqual(matchDivision(units, { file: "f", name: "GNS", code: null }), { kind: "found", division: units[0], by: "name" });
  assert.deepEqual(matchDivision(units, { file: "f", name: "Safety", code: null }), { kind: "several", divisions: [units[2], units[3]] });
  assert.deepEqual(matchDivision(units, { file: "f", name: "Recovery", code: "RCV" }), { kind: "absent" });
  // A code is compared as a code: "GN" is not "GNS".
  assert.deepEqual(matchDivision(units, { file: "f", name: "Nothing", code: "GN" }), { kind: "absent" });
});

test("the test division is known by its name or its code", () => {
  assert.equal(isTestDivision({ file: "f", name: "test-division-website", code: null }), true);
  assert.equal(isTestDivision({ file: "f", name: "Test Division Website", code: "XYZ" }), true);
  assert.equal(isTestDivision({ file: "f", name: "Anything", code: "TDW" }), true);
  assert.equal(isTestDivision({ file: "f", name: "Testing", code: "TST" }), false);
});

test("list cells read the old export's shapes", () => {
  assert.deepEqual(listOf('["CAD", "Python"]'), ["CAD", "Python"]);
  assert.deepEqual(listOf('{"Fluid dynamics",Teamwork}'), ["Fluid dynamics", "Teamwork"]);
  assert.deepEqual(listOf("- TypeScript\n- SQL\n"), ["TypeScript", "SQL"]);
  assert.deepEqual(listOf("  "), []);
});
