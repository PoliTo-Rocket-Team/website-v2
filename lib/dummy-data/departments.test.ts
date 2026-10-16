import assert from "node:assert/strict";
import { test } from "node:test";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import { NO_EDITS, parseEdits, serializeEdits, type TeamEdits } from "./edits";
import { dummyTeamPages } from "./team-pages";

// New department, Edit department and Close department on a preview (#251):
// what each save does to the team the test developer sees next. The rules
// themselves are lib/dashboard/department-edit.test.ts's.

/** `kind`'s pages over `edits`, with each save kept after a round trip through the cookie. */
function pages(kind: ViewerKind, edits: TeamEdits = NO_EDITS) {
  let kept = edits;
  const view = dummyTeamPages(kind, edits, async (next) => {
    kept = parseEdits(serializeEdits(next));
  });
  return { writes: view.teamWrites!, view, kept: () => kept };
}

const AERODYNAMICS = 1;
const STRUCTURES = 2;
const MISSION_ANALYSIS = 1;
const OPTIMIZATION = 2;
const DESIGN = 3;
const SARA = 7; // a member of Mission Analysis
const CHIARA = 15; // Head of Aerodynamics, in no division

async function structureOf(edits: TeamEdits) {
  return (await pages("operations-lead", edits).view.teamStructure())!;
}

test("New department opens with its one head, who keeps their divisions", async () => {
  const ops = pages("operations-lead");
  const created = await ops.writes.createDepartment({ name: "Propulsion", code: "pr", heads: [SARA] });
  assert.ok(created.ok);
  const structure = await structureOf(ops.kept());
  const propulsion = structure.departments.find((d) => d.id === created.value)!;
  assert.deepEqual([propulsion.name, propulsion.code, propulsion.head?.id, propulsion.divisions.length], ["Propulsion", "PR", SARA, 0]);
  const mission = structure.departments.find((d) => d.id === AERODYNAMICS)!.divisions.find((d) => d.id === MISSION_ANALYSIS)!;
  assert.ok(mission.page!.people.some((p) => p.id === SARA), "still in Mission Analysis");
  assert.equal((await ops.writes.createDepartment({ name: "Payload", code: "PL", heads: [] })).ok, false, "no head");
});

test("Edit department stores a new name and code", async () => {
  const ops = pages("operations-lead");
  assert.deepEqual(await ops.writes.saveDepartment(AERODYNAMICS, { name: "Aerodynamics and Flight", code: "af" }), { ok: true, value: null });
  const aero = (await structureOf(ops.kept())).departments.find((d) => d.id === AERODYNAMICS)!;
  assert.deepEqual([aero.name, aero.code], ["Aerodynamics and Flight", "AF"]);
  assert.equal((await pages("operations-lead", ops.kept()).view.teamTree()).departments.find((d) => d.id === AERODYNAMICS)?.name, "Aerodynamics and Flight");
});

test("a department head manages no department, and the server refuses each department write", async () => {
  const head = pages("department-head");
  assert.equal((await head.writes.createDepartment({ name: "Propulsion", code: "PR", heads: [SARA] })).ok, false);
  assert.equal((await head.writes.saveDepartment(AERODYNAMICS, { name: "Aero", code: "AE" })).ok, false);
  const fates = { divisions: [{ divisionId: MISSION_ANALYSIS, action: "move", to: STRUCTURES }, { divisionId: OPTIMIZATION, action: "move", to: STRUCTURES }] };
  assert.equal((await head.writes.closeDepartment(AERODYNAMICS, fates)).ok, false);
  assert.equal(head.kept(), NO_EDITS, "nothing is saved");
  assert.equal((await head.view.teamStructure())!.departmentsEditable, false);
});

test("a department head's division writes outside their own department are refused", async () => {
  const head = pages("department-head");
  const keep = { name: "Design & Manufacturing", code: "DM", newLeads: [], oldLeads: [], members: [], emails: [] };
  assert.equal((await head.writes.createDivision(STRUCTURES, { ...keep, name: "Composites", code: "CO", newLeads: [SARA] })).ok, false);
  assert.equal((await head.writes.saveDivision(DESIGN, { ...keep, code: "DX" })).ok, false);
  assert.equal((await head.writes.closeDivision(DESIGN)).ok, false);
  assert.equal(head.kept(), NO_EDITS, "nothing is saved");
});

test("Close department moves each division with its people and closes the empty ones; the head stays on the team", async () => {
  const ops = pages("operations-lead");
  // A new division in Aerodynamics, then its only lead taken out, leaves one empty division to close.
  const created = await ops.writes.createDivision(AERODYNAMICS, { name: "Flight Dynamics", code: "FD", newLeads: [13], oldLeads: [], members: [], emails: [] });
  assert.ok(created.ok);
  const emptied = pages("operations-lead", ops.kept());
  assert.equal(await emptied.writes.removeFromDivision(13, created.value), true);

  const before = await structureOf(emptied.kept());
  const missionBefore = before.departments.find((d) => d.id === AERODYNAMICS)!.divisions.find((d) => d.id === MISSION_ANALYSIS)!;
  const closer = pages("operations-lead", emptied.kept());
  const refused = await closer.writes.closeDepartment(AERODYNAMICS, {
    divisions: [
      { divisionId: MISSION_ANALYSIS, action: "close" },
      { divisionId: OPTIMIZATION, action: "move", to: STRUCTURES },
      { divisionId: created.value, action: "close" },
    ],
  });
  assert.equal(refused.ok, false, "a division with people in it can only move");

  const closed = await closer.writes.closeDepartment(AERODYNAMICS, {
    divisions: [
      { divisionId: MISSION_ANALYSIS, action: "move", to: STRUCTURES },
      { divisionId: OPTIMIZATION, action: "move", to: STRUCTURES },
      { divisionId: created.value, action: "close" },
    ],
  });
  assert.deepEqual(closed, { ok: true, value: null });

  const after = await structureOf(closer.kept());
  assert.ok(!after.departments.some((d) => d.id === AERODYNAMICS), "the department is closed");
  const structures = after.departments.find((d) => d.id === STRUCTURES)!;
  const mission = structures.divisions.find((d) => d.id === MISSION_ANALYSIS)!;
  assert.deepEqual(
    mission.page!.people.map((p) => [p.id, p.role]),
    missionBefore.page!.people.map((p) => [p.id, p.role]),
    "its people and leads moved with it",
  );
  assert.ok(structures.divisions.some((d) => d.id === OPTIMIZATION));
  assert.ok(!after.departments.flatMap((d) => d.divisions).some((d) => d.id === created.value), "the empty division is closed");

  const view = pages("operations-lead", closer.kept()).view;
  assert.ok(!(await view.alumni()).rows.some((a) => a.key === `m${CHIARA}`), "the head is not moved to Alumni");
  const members = await view.members();
  assert.ok(members.scope === "team" && members.rows.some((r) => r.id === CHIARA), "and stays on the team");
});
