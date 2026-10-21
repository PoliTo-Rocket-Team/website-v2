import assert from "node:assert/strict";
import { test } from "node:test";
import { pickApplyData, type ApplySides } from "@/lib/apply/pick";
import { isPublic } from "@/lib/apply/positions";
import { dummyApplyData, SentApplications } from "./apply";
import { NO_EDITS, serializeEdits, type TeamEdits } from "./edits";
import type { DummyModeEnv } from "./mode";
import { DEFAULT_DUMMY_RECRUITMENT } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import { divisions, positions } from "./team";

// Issue #474: in dummy mode, a division or department the test developer
// closed on the Team pages closes its positions on /apply and on
// /apply/<slug>, as the dashboard already closes them. The edits below are
// the ones Close division and Close department write (./team-pages.ts).

const PREVIEW: DummyModeEnv = { NODE_ENV: "production", VERCEL_ENV: "preview" };
const CLOSED_ON = "2026-10-21";

/** The edits Close division writes for `divisionId`. */
function closingDivision(divisionId: number): TeamEdits {
  const d = divisions.find((x) => x.id === divisionId)!;
  return { ...NO_EDITS, divisions: { [d.id]: { name: d.name, code: d.code, departmentId: d.departmentId, closedOn: CLOSED_ON } } };
}

/** The edits Close department writes for `departmentId`: the department and each of its divisions closed. */
function closingDepartment(departmentId: number): TeamEdits {
  const own = divisions.filter((d) => d.departmentId === departmentId);
  return {
    ...NO_EDITS,
    divisions: Object.fromEntries(
      own.map((d) => [d.id, { name: d.name, code: d.code, departmentId: d.departmentId, closedOn: CLOSED_ON }]),
    ),
    departments: { [departmentId]: { name: "Aerodynamics", code: "AE", closedOn: CLOSED_ON, headId: null } },
  };
}

function applyWith(team: TeamEdits) {
  return dummyApplyData(null, null, DEFAULT_DUMMY_RECRUITMENT, new SentApplications(), undefined, undefined, EMPTY_DUMMY_STATE, team);
}

const listedIds = async (team: TeamEdits) => (await applyWith(team).publicPositions()).map((p) => p.id);

/** The open positions of ./team.ts in `divisionIds`. */
const openIn = (divisionIds: readonly number[]) => positions.filter((p) => p.open && divisionIds.includes(p.divisionId)).map((p) => p.id);

test("with no team edits, /apply lists every open position, as before", async () => {
  const listed = await dummyApplyData(null, null, DEFAULT_DUMMY_RECRUITMENT, new SentApplications()).publicPositions();
  assert.deepEqual(await applyWith(NO_EDITS).publicPositions(), listed);
  assert.deepEqual(
    listed.map((p) => p.id),
    positions.filter((p) => p.open).map((p) => p.id),
  );
});

test("a division closed on the Team pages has none of its positions on /apply", async () => {
  const shut = openIn([1]);
  assert.ok(shut.length > 0, "division 1 has open positions to close");
  const listed = await listedIds(closingDivision(1));
  for (const id of shut) assert.ok(!listed.includes(id), `position ${id} is not listed`);
  // The other division of the same department stays open.
  for (const id of openIn([2])) assert.ok(listed.includes(id), `position ${id} is still listed`);
});

test("a department closed on the Team pages has none of its divisions' positions on /apply", async () => {
  const departmentDivisions = divisions.filter((d) => d.departmentId === 1).map((d) => d.id);
  const shut = openIn(departmentDivisions);
  assert.ok(shut.length > 0, "department 1 has open positions to close");
  const listed = await listedIds(closingDepartment(1));
  for (const id of shut) assert.ok(!listed.includes(id), `position ${id} is not listed`);
  for (const id of openIn(divisions.filter((d) => d.departmentId !== 1).map((d) => d.id))) {
    assert.ok(listed.includes(id), `position ${id} in another department is still listed`);
  }
});

test("the /apply/<slug> page reads a position in a closed division as closed, so it offers no form", async () => {
  const id = openIn([1])[0]!;
  const data = applyWith(closingDivision(1));
  for (const read of [data.shownPosition(id), data.position(id)]) {
    const found = await read;
    assert.ok(found, "the page still resolves");
    assert.equal(found.position.status, false);
    assert.equal(isPublic(found.position, found.recruitment), false);
  }
  const open = await applyWith(NO_EDITS).shownPosition(id);
  assert.equal(open?.position.status, true, "without the edits it is open");
});

test("a request carrying the Team page edits cookie reads the same closes (lib/apply/pick.ts)", async () => {
  const sides: ApplySides = {
    database: () => {
      throw new Error("a preview with no database reads the dummy side");
    },
    dummy: (viewer, openSelector, recruitment, own, ownStart, dashboard, team) =>
      dummyApplyData(viewer, openSelector, recruitment, new SentApplications(), own, ownStart, dashboard, team),
  };
  const data = pickApplyData({ env: PREVIEW, viewerCookie: null, openSelector: null, editsCookie: serializeEdits(closingDivision(1)) }, sides);
  const listed = (await data.publicPositions()).map((p) => p.id);
  for (const id of openIn([1])) assert.ok(!listed.includes(id), `position ${id} is not listed`);
});
