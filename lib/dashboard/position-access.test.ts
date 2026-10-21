import assert from "node:assert/strict";
import { test } from "node:test";
import { mayChangePositionIn, type PositionWriter } from "./position-access";
import type { RoleType } from "./team";
import { areaGrantsOf, viewerStandingOf, viewerUnitsOf, type FlaggedSeat, type ScopeUnitRow } from "./viewer";

// The one rule the database side asks before editing a position, switching
// it open or closed, or moving an application to it (issue #461), for each
// role, with the viewer built from roles and scope rows as `readIdentity`
// builds it (lib/dashboard/database.ts).

const AERODYNAMICS = 1;
const STRUCTURES = 2;
const MISSION_ANALYSIS = { divisionId: 1, departmentId: AERODYNAMICS };
const OPTIMIZATION = { divisionId: 2, departmentId: AERODYNAMICS };
const STRUCTURES_ANALYSIS = { divisionId: 4, departmentId: STRUCTURES };
const UNITS = [MISSION_ANALYSIS, OPTIMIZATION, STRUCTURES_ANALYSIS];

type Role = {
  readonly type: RoleType;
  readonly divisionId: number | null;
  readonly departmentId: number | null;
  readonly fullAccess: FlaggedSeat | null;
};

const role = (type: RoleType, unit: { divisionId: number | null; departmentId: number | null }, fullAccess: FlaggedSeat | null = null): Role => ({
  type,
  ...unit,
  fullAccess,
});

/** The viewer `readIdentity` reads from these active roles and scope rows. */
function writerOf(roles: readonly Role[], scopes: readonly ScopeUnitRow[] = []): PositionWriter {
  const units = viewerUnitsOf(scopes, roles);
  return {
    ...viewerStandingOf({ scopes, activeRoles: roles }),
    roles,
    divisionIds: [...units.divisionIds],
    departmentIds: [...units.departmentIds],
    grants: areaGrantsOf(scopes),
  };
}

const NO_UNIT = { divisionId: null, departmentId: null };

/** Each role as the dashboard reads it, and the units it may change positions and applications in. */
const CASES: readonly { readonly name: string; readonly viewer: PositionWriter; readonly changes: readonly (typeof MISSION_ANALYSIS)[] }[] = [
  // The team leader's seat is the `president` role, with no scope row (issue #444).
  { name: "team leader", viewer: writerOf([role("president", NO_UNIT)]), changes: UNITS },
  // A team leader who also keeps a member role in one division is still the team leader everywhere.
  { name: "team leader with a member role", viewer: writerOf([role("core", OPTIMIZATION), role("president", NO_UNIT)]), changes: UNITS },
  { name: "department head", viewer: writerOf([role("head", { divisionId: null, departmentId: AERODYNAMICS })]), changes: [MISSION_ANALYSIS, OPTIMIZATION] },
  { name: "division lead", viewer: writerOf([role("lead", MISSION_ANALYSIS)]), changes: [MISSION_ANALYSIS] },
  { name: "lead of two divisions", viewer: writerOf([role("lead", MISSION_ANALYSIS), role("lead", STRUCTURES_ANALYSIS)]), changes: [MISSION_ANALYSIS, STRUCTURES_ANALYSIS] },
  { name: "member", viewer: writerOf([role("core", MISSION_ANALYSIS)]), changes: [] },
];

test("the team leader is full access through their seat, with no scope row (issue #444)", () => {
  const leader = writerOf([role("president", NO_UNIT)]);
  assert.equal(leader.kind, "operations-lead");
  assert.equal(leader.kind === "operations-lead" ? leader.seat : null, "team-leader");
  assert.deepEqual(leader.grants, []);
});

test("each role edits, switches and moves applications only in its own units, and the team leader everywhere (issue #461)", () => {
  for (const { name, viewer, changes } of CASES) {
    for (const unit of UNITS) {
      for (const area of ["positions", "applications"] as const) {
        assert.equal(mayChangePositionIn(viewer, area, unit), changes.includes(unit), `${name}, ${area}, division ${unit.divisionId}`);
      }
    }
  }
});

test("a member changes a position only with a Can edit grant on that area covering it (issue #160)", () => {
  const grant = (target: "positions" | "applications", level: "view" | "edit"): ScopeUnitRow => ({
    scope: "division",
    target,
    level,
    divisionId: MISSION_ANALYSIS.divisionId,
    deptId: null,
  });
  const editor = writerOf([role("core", OPTIMIZATION)], [grant("positions", "edit")]);
  assert.equal(mayChangePositionIn(editor, "positions", MISSION_ANALYSIS), true);
  assert.equal(mayChangePositionIn(editor, "applications", MISSION_ANALYSIS), false);
  assert.equal(mayChangePositionIn(editor, "positions", OPTIMIZATION), false, "their own division is not granted");
  const viewerOnly = writerOf([role("core", OPTIMIZATION)], [grant("positions", "view")]);
  assert.equal(mayChangePositionIn(viewerOnly, "positions", MISSION_ANALYSIS), false);
});

test("someone off the team changes nothing, whatever scope rows remain (issue #201)", () => {
  const alumnus = writerOf([], [{ scope: "admin", target: "all", level: "edit", divisionId: null, deptId: null }]);
  for (const unit of UNITS) assert.equal(mayChangePositionIn(alumnus, "positions", unit), false);
});
